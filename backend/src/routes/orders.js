const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generateOrderCode } = require('../utils/orderCode');

const router = express.Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { productIds } = req.body || {};
    let productRows;

    if (Array.isArray(productIds) && productIds.length > 0) {
      const result = await client.query(
        'SELECT id, name, price_clp FROM products WHERE id = ANY($1) AND active = true',
        [productIds]
      );
      productRows = result.rows;
    } else {
      const result = await client.query(
        `SELECT p.id, p.name, p.price_clp
         FROM cart_items c JOIN products p ON p.id = c.product_id
         WHERE c.user_id = $1 AND p.active = true`,
        [req.user.id]
      );
      productRows = result.rows;
    }

    if (productRows.length === 0) {
      return res.status(400).json({ error: 'No hay productos para generar el pedido.' });
    }

    const memberResult = await client.query(
      'SELECT membership_status, membership_expires_at, membership_discount_percent FROM users WHERE id = $1',
      [req.user.id]
    );
    const mem = memberResult.rows[0];
    const memberActive = mem.membership_status === 'active' && mem.membership_expires_at && new Date(mem.membership_expires_at) > new Date();
    const discountPct = memberActive ? mem.membership_discount_percent : 0;
    if (discountPct > 0) {
      productRows = productRows.map((p) => ({ ...p, price_clp: Math.round(p.price_clp * (100 - discountPct) / 100) }));
    }

    const total = productRows.reduce((sum, p) => sum + p.price_clp, 0);

    await client.query('BEGIN');

    let order;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const orderCode = generateOrderCode();
        const orderResult = await client.query(
          `INSERT INTO orders (order_code, user_id, status, total_clp)
           VALUES ($1, $2, 'pending', $3) RETURNING id, order_code, status, total_clp, created_at`,
          [orderCode, req.user.id, total]
        );
        order = orderResult.rows[0];
        break;
      } catch (e) {
        if (e.code === '23505' && attempt < 4) continue;
        throw e;
      }
    }

    for (const p of productRows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, price_clp, downloads_allowed)
         VALUES ($1, $2, $3, $4, 5)`,
        [order.id, p.id, p.name, p.price_clp]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ order: { ...order, items: productRows } });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error creando pedido:', e.message);
    res.status(500).json({ error: 'No se pudo generar el pedido.' });
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT id, order_code, status, total_clp, created_at, paid_at
     FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ orders: result.rows });
});

router.get('/:orderCode', async (req, res) => {
  const orderResult = await db.query(
    `SELECT id, order_code, user_id, status, total_clp, created_at, paid_at
     FROM orders WHERE order_code = $1`,
    [req.params.orderCode]
  );
  const order = orderResult.rows[0];
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

  if (order.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'No tienes acceso a este pedido.' });
  }

  const itemsResult = await db.query(
    `SELECT id, product_id, product_name, price_clp, downloads_allowed, downloads_used
     FROM order_items WHERE order_id = $1`,
    [order.id]
  );

  res.json({
    order: {
      orderCode: order.order_code,
      status: order.status,
      totalClp: order.total_clp,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      items: itemsResult.rows.map((it) => ({
        orderItemId: it.id,
        productId: it.product_id,
        name: it.product_name,
        priceClp: it.price_clp,
        downloadsLeft: it.downloads_allowed - it.downloads_used,
      })),
    },
  });
});

module.exports = router;
