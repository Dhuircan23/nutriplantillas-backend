const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { reconcilePendingOrders } = require('../jobs/reconcilePendingOrders');
const { markOrderPaid } = require('./payments');
const { getPaymentProvider } = require('../services/paymentProvider');
const { ORDER_STATUS } = require('../utils/orderStatus');
const { logSecurityEvent } = require('../services/auditLog');

const router = express.Router();

// Todo lo administrativo exige rol admin verificado en el backend. Ocultar
// botones en el frontend no es una medida de seguridad.
router.use(requireAdmin);

// POST /api/admin/reconcile
// Dispara la reconciliación de pedidos pendientes a demanda, sin esperar al
// intervalo automático. Útil si alguien reporta "pagué y no me llegó nada".
router.post('/reconcile', async (req, res) => {
  const summary = await reconcilePendingOrders();
  res.json({ summary });
});

// POST /api/admin/orders/:orderCode/confirm-manual
// Confirma a mano un pedido del proveedor de pago simulado. Es la única forma
// de completar la cadena compra -> permiso -> descarga mientras Transbank NO
// está conectado, y deja rastro de quién lo confirmó.
//
// Guardas: solo con el proveedor manual activo, solo desde un estado no pagado,
// y nunca sobre un pedido ya pagado (evita duplicar cupos de descarga).
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

  // Rastro de la acción administrativa: quién confirmó qué pedido y por cuánto.
  logSecurityEvent(
    'admin_manual_payment',
    `admin=${req.user.id} pedido=${req.params.orderCode} monto=${order.total_clp}`,
    req
  );

  res.json({ ok: true, orderCode: req.params.orderCode, status: ORDER_STATUS.PAID });
});

// GET /api/admin/download-events
// Últimos intentos de descarga, para investigar abusos o un "no puedo bajar mi
// archivo". Solo devuelve metadatos: nunca tokens, cookies ni credenciales.
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
