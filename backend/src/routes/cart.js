const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT p.id, p.sku, p.name, p.category, p.price_clp, p.version
     FROM cart_items c JOIN products p ON p.id = c.product_id
     WHERE c.user_id = $1 AND p.active = true
     ORDER BY c.created_at`,
    [req.user.id]
  );
  res.json({ items: result.rows });
});

router.post('/', async (req, res) => {
  const { productId } = req.body || {};
  if (typeof productId !== 'string') return res.status(400).json({ error: 'productId requerido.' });

  const product = await db.query('SELECT id FROM products WHERE id = $1 AND active = true', [productId]);
  if (product.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado.' });

  // ON CONFLICT: agregar un producto ya presente en el carrito es un no-op, no un error.
  await db.query(
    `INSERT INTO cart_items (user_id, product_id) VALUES ($1, $2)
     ON CONFLICT (user_id, product_id) DO NOTHING`,
    [req.user.id, productId]
  );
  res.status(201).json({ ok: true });
});

router.delete('/:productId', async (req, res) => {
  await db.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [
    req.user.id,
    req.params.productId,
  ]);
  res.json({ ok: true });
});

module.exports = router;
