const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getPaymentProvider } = require('../services/paymentProvider');
const { canStartPayment, ORDER_STATUS } = require('../utils/orderStatus');
const { getPrimaryFrontendUrl } = require('../utils/origins');

const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const FRONTEND_URL = getPrimaryFrontendUrl();

router.post('/:orderCode/init', requireAuth, async (req, res) => {
  const orderResult = await db.query(
    'SELECT id, user_id, status, total_clp FROM orders WHERE order_code = $1',
    [req.params.orderCode]
  );
  const order = orderResult.rows[0];
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado.' });
  if (!canStartPayment(order.status)) {
    return res.status(409).json({ error: `El pedido ya está en estado "${order.status}".` });
  }

  const provider = getPaymentProvider();

  try {
    const emailResult = await db.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    const email = emailResult.rows[0] && emailResult.rows[0].email;

    const attempt = await provider.createTransaction({
      orderCode: req.params.orderCode,
      amountClp: order.total_clp,
      email,
      returnUrl: `${BACKEND_URL}/api/payments/webpay/return`,
      flowReturnUrl: `${BACKEND_URL}/api/payments/flow/return`,
      flowConfirmationUrl: `${BACKEND_URL}/api/payments/flow/confirm`,
      mpReturnUrl: `${BACKEND_URL}/api/payments/mp/return`,
      mpNotificationUrl: `${BACKEND_URL}/api/payments/mp/webhook`,
      sessionRef: `ord-${req.params.orderCode}`,
    });

    await db.query(
      `UPDATE orders
       SET webpay_token = $1, webpay_buy_order = $2, payment_provider = $3, status = $4
       WHERE id = $5`,
      [
        attempt.token || null,
        attempt.buyOrder || null,
        provider.name,
        provider.name === 'manual' ? ORDER_STATUS.PAYMENT_PROCESSING : order.status,
        order.id,
      ]
    );

    if (!attempt.redirectUrl) {
      return res.json({
        provider: provider.name,
        requiresManualConfirmation: true,
        instructions: attempt.instructions,
      });
    }
    res.json({ provider: provider.name, url: attempt.redirectUrl, token: attempt.token, method: attempt.method });
  } catch (e) {
    console.error('Error iniciando pago:', provider.name, e.message);
    res.status(502).json({ error: 'No se pudo iniciar el pago.' });
  }
});

async function handleWebpayReturn(req, res) {
  const params = { ...req.query, ...req.body };
  const { token_ws, TBK_TOKEN, TBK_ORDEN_COMPRA } = params;

  async function markFailedByBuyOrder(buyOrder, reason) {
    if (!buyOrder) return;
    await db.query(
      `UPDATE orders SET status = $1
       WHERE webpay_buy_order = $2 AND status IN ($3, $4)`,
      [ORDER_STATUS.FAILED, buyOrder, ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PROCESSING]
    );
    console.warn('Pago no completado:', reason, buyOrder);
  }

  if (!token_ws && TBK_TOKEN) {
    await markFailedByBuyOrder(TBK_ORDEN_COMPRA, 'anulado por el comprador');
    return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=cancelled`);
  }
  if (!token_ws) {
    return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=timeout`);
  }

  try {
    const provider = getPaymentProvider();
    const outcome = await provider.commitTransaction({ token: token_ws });

    const orderResult = await db.query(
      'SELECT id, user_id, order_code FROM orders WHERE webpay_token = $1',
      [token_ws]
    );
    const order = orderResult.rows[0];
    if (!order) {
      console.error('Confirmación de pago sin pedido asociado.');
      return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=error`);
    }

    if (!outcome.approved) {
      await db.query('UPDATE orders SET status = $1 WHERE id = $2', [ORDER_STATUS.FAILED, order.id]);
      return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=declined`);
    }

    await markOrderPaid(order.id, order.user_id);
    return res.redirect(`${FRONTEND_URL}/Confirmation.dc.html?order=${order.order_code}`);
  } catch (e) {
    console.error('Error confirmando pago:', e.message);
    return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=error`);
  }
}

async function markOrderPaid(orderId, userId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE orders SET status = $1, paid_at = now() WHERE id = $2', [
      ORDER_STATUS.PAID,
      orderId,
    ]);
    const items = await client.query('SELECT product_id FROM order_items WHERE order_id = $1', [orderId]);
    const productIds = items.rows.map((r) => r.product_id);
    if (productIds.length > 0) {
      await client.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = ANY($2)', [
        userId,
        productIds,
      ]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

router.get('/webpay/return', handleWebpayReturn);
router.post('/webpay/return', handleWebpayReturn);

async function verifyAndMarkFlow(token) {
  const { getStatus } = require('../services/flow');
  const result = await getStatus(token);
  const statusCode = Number(result.status);
  const approved = statusCode === 2;

  const orderResult = await db.query(
    'SELECT id, user_id, order_code, status FROM orders WHERE webpay_token = $1',
    [token]
  );
  const order = orderResult.rows[0];
  if (!order) return { order: null, approved: false };

  if (order.status === ORDER_STATUS.PAID) return { order, approved: true, already: true };

  if (approved) {
    await markOrderPaid(order.id, order.user_id);
  } else if (statusCode === 3 || statusCode === 4) {
    await db.query('UPDATE orders SET status = $1 WHERE id = $2', [ORDER_STATUS.FAILED, order.id]);
  }
  return { order, approved };
}

async function handleFlowReturn(req, res) {
  const token = (req.query && req.query.token) || (req.body && req.body.token);
  if (!token) return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=error`);
  try {
    const { order, approved } = await verifyAndMarkFlow(token);
    if (!order) return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=error`);
    if (!approved) return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=declined`);
    return res.redirect(`${FRONTEND_URL}/Confirmation.dc.html?order=${order.order_code}`);
  } catch (e) {
    console.error('Error confirmando pago Flow (return):', e.message);
    return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=error`);
  }
}

async function handleFlowConfirm(req, res) {
  const token = (req.body && req.body.token) || (req.query && req.query.token);
  if (!token) return res.status(400).send('missing token');
  try {
    await verifyAndMarkFlow(token);
    res.status(200).send('OK');
  } catch (e) {
    console.error('Error confirmando pago Flow (webhook):', e.message);
    res.status(500).send('error');
  }
}

router.get('/flow/return', handleFlowReturn);
router.post('/flow/return', handleFlowReturn);
router.post('/flow/confirm', handleFlowConfirm);

// Verifica un pago de Mercado Pago contra su API (nunca se confía en los
// parámetros de la URL) y marca el pedido según el resultado. Compartida entre
// el retorno del navegador y el webhook.
async function verifyAndMarkMercadoPago({ orderCode, paymentId }) {
  const { getPaymentProvider: getProvider } = require('../services/paymentProvider');
  const provider = getProvider();

  const orderResult = await db.query(
    'SELECT id, user_id, order_code, status FROM orders WHERE order_code = $1',
    [orderCode]
  );
  const order = orderResult.rows[0];
  if (!order) return { order: null, approved: false };
  if (order.status === ORDER_STATUS.PAID) return { order, approved: true, already: true };

  const outcome = await provider.commitTransaction({ token: orderCode, paymentId });

  if (outcome.approved) {
    await markOrderPaid(order.id, order.user_id);
  } else if (['rejected', 'cancelled'].includes(outcome.providerStatus)) {
    await db.query('UPDATE orders SET status = $1 WHERE id = $2', [ORDER_STATUS.FAILED, order.id]);
  }
  return { order, approved: outcome.approved };
}

// GET /api/payments/mp/return — el comprador vuelve desde Mercado Pago.
// MP agrega external_reference y payment_id a la URL de retorno.
async function handleMercadoPagoReturn(req, res) {
  const params = { ...req.query, ...req.body };
  const orderCode = params.external_reference;
  const paymentId = params.payment_id || params.collection_id;
  if (!orderCode) return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=error`);
  try {
    const { order, approved } = await verifyAndMarkMercadoPago({ orderCode, paymentId });
    if (!order) return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=error`);
    if (!approved) return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=declined`);
    return res.redirect(`${FRONTEND_URL}/Confirmation.dc.html?order=${order.order_code}`);
  } catch (e) {
    console.error('Error confirmando pago MP (return):', e.message);
    return res.redirect(`${FRONTEND_URL}/Checkout.dc.html?payment=error`);
  }
}

// POST /api/payments/mp/webhook — notificación servidor-a-servidor de MP.
// Responde 200 rápido: MP reintenta si no recibe respuesta.
async function handleMercadoPagoWebhook(req, res) {
  const body = req.body || {};
  const paymentId = (body.data && body.data.id) || req.query['data.id'] || req.query.id;
  if (!paymentId) return res.status(200).send('OK');
  try {
    const { getPayment } = require('../services/mercadopago');
    const payment = await getPayment(paymentId);
    if (payment && payment.external_reference) {
      await verifyAndMarkMercadoPago({ orderCode: payment.external_reference, paymentId });
    }
    res.status(200).send('OK');
  } catch (e) {
    console.error('Error procesando webhook MP:', e.message);
    res.status(200).send('OK');
  }
}

router.get('/mp/return', handleMercadoPagoReturn);
router.post('/mp/return', handleMercadoPagoReturn);
router.post('/mp/webhook', handleMercadoPagoWebhook);

module.exports = router;
module.exports.markOrderPaid = markOrderPaid;
