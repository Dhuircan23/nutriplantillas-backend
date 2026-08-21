const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { reconcilePendingOrders } = require('../jobs/reconcilePendingOrders');
const { markOrderPaid } = require('./payments');
const { getPaymentProvider } = require('../services/paymentProvider');
const { ORDER_STATUS } = require('../utils/orderStatus');
const { logSecurityEvent } = require('../services/auditLog');

const router = express.Router();

router.use(requireAdmin);

router.get('/orders', async (req, res) => {
  const result = await db.query(
    `SELECT o.id, o.order_code, o.status, o.total_clp, o.created_at, o.paid_at,
            u.email AS customer_email,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC
     LIMIT 200`
  );
  res.json({ orders: result.rows });
});

router.get('/stats', async (req, res) => {
  const revenue = await db.query(
    `SELECT COALESCE(SUM(total_clp), 0)::int AS revenue, COUNT(*)::int AS paid_orders
     FROM orders WHERE status = 'paid'`
  );
  const ordersCount = await db.query('SELECT COUNT(*)::int AS c FROM orders');
  const salesCount = await db.query(
    `SELECT COUNT(*)::int AS c FROM order_items oi
     JOIN orders o ON o.id = oi.order_id WHERE o.status = 'paid'`
  );
  const customersCount = await db.query(
    `SELECT COUNT(DISTINCT user_id)::int AS c FROM orders WHERE status = 'paid'`
  );
  const monthly = await db.query(
    `SELECT to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month,
            COALESCE(SUM(total_clp), 0)::int AS revenue
     FROM orders WHERE status = 'paid' AND paid_at >= now() - interval '12 months'
     GROUP BY 1 ORDER BY 1`
  );
  const topProducts = await db.query(
    `SELECT oi.product_id, oi.product_name AS name, COUNT(*)::int AS sales
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.status = 'paid'
     GROUP BY oi.product_id, oi.product_name
     ORDER BY sales DESC LIMIT 5`
  );
  res.json({
    revenueClp: revenue.rows[0].revenue,
    paidOrders: revenue.rows[0].paid_orders,
    ordersCount: ordersCount.rows[0].c,
    salesCount: salesCount.rows[0].c,
    customersCount: customersCount.rows[0].c,
    monthlySales: monthly.rows,
    topProducts: topProducts.rows,
  });
});

router.get('/customers', async (req, res) => {
  const result = await db.query(
    `SELECT u.id, u.email, u.name, u.country,
            COUNT(o.id) FILTER (WHERE o.status = 'paid')::int AS paid_orders,
            COALESCE(SUM(o.total_clp) FILTER (WHERE o.status = 'paid'), 0)::int AS total_spent_clp,
            MAX(o.created_at) AS last_order_at
     FROM users u
     LEFT JOIN orders o ON o.user_id = u.id
     WHERE u.role = 'client'
     GROUP BY u.id
     ORDER BY paid_orders DESC, u.id DESC
     LIMIT 300`
  );
  res.json({ customers: result.rows });
});

router.get('/products', async (req, res) => {
  const result = await db.query(
    `SELECT p.id, p.sku, p.name, p.category, p.price_clp, p.version, p.active, p.updated_label,
            COUNT(oi.id) FILTER (WHERE o.status = 'paid')::int AS sales
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id
     GROUP BY p.id
     ORDER BY p.sku`
  );
  res.json({ products: result.rows });
});

router.post('/reconcile', async (req, res) => {
  const summary = await reconcilePendingOrders();
  res.json({ summary });
});

router.post('/orders/:orderCode/confirm-manual', async (req, res) => {
  const provider = getPaymentProvider();
  if (provider.name !== 'manual') {
    return res.status(409).json({
      error: `La confirmación manual solo aplica con PAYMENT_PROVIDER=manual (activo: ${provider.name}).`,
    });
  }

  const result = await db.query(
    'SELECT id, user_id, status, total_clp FROM orders WHERE order_code = $1',
    [req.params.orderCode]
  );
  const order = result.rows[0];
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

  if (order.status === ORDER_STATUS.PAID) {
    return res.status(409).json({ error: 'El pedido ya estaba pagado.' });
  }
  const confirmable = [ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PROCESSING, ORDER_STATUS.AUTHORIZED];
  if (!confirmable.includes(order.status)) {
    return res.status(409).json({ error: `No se puede confirmar un pedido en estado "${order.status}".` });
  }

  await markOrderPaid(order.id, order.user_id);

  logSecurityEvent(
    'admin_manual_payment',
    `admin=${req.user.id} pedido=${req.params.orderCode} monto=${order.total_clp}`,
    req
  );

  res.json({ ok: true, orderCode: req.params.orderCode, status: ORDER_STATUS.PAID });
});

router.get('/download-events', async (req, res) => {
  const onlyDenied = req.query.denied === 'true';
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const result = await db.query(
    `SELECT id, user_id, order_item_id, asset_type, outcome, reason, ip, created_at
     FROM download_events
     ${onlyDenied ? "WHERE outcome <> 'allowed'" : ''}
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json({ events: result.rows });
});

module.exports = router;
