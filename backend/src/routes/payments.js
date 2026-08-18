const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getPaymentProvider } = require('../services/paymentProvider');
const { canStartPayment, ORDER_STATUS } = require('../utils/orderStatus');
const { getPrimaryFrontendUrl } = require('../utils/origins');

const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const FRONTEND_URL = getPrimaryFrontendUrl();

// POST /api/payments/:orderCode/init
// Inicia un intento de pago a través del PaymentProvider activo.
//   - PAYMENT_PROVIDER=manual (por defecto): no cobra. Deja el pedido en
//     payment_processing y devuelve instrucciones. Solo un admin puede
//     confirmarlo (ver POST /api/admin/orders/:orderCode/confirm-manual).
//   - PAYMENT_PROVIDER=webpay: devuelve { url, token } para el POST de
//     redirección a Transbank. NO activo por defecto.
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
    const attempt = await provider.createTransaction({
      orderCode: req.params.orderCode,
      amountClp: order.total_clp,
      returnUrl: `${BACKEND_URL}/api/payments/webpay/return`,
      // Referencia opaca: no se manda el id interno del usuario a un tercero.
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
        // El proveedor manual queda esperando confirmación; el redirigido sigue
        // 'pending' hasta que Transbank conteste, para no bloquear un reintento.
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
    res.json({ provider: provider.name, url: attempt.redirectUrl, token: attempt.token });
  } catch (e) {
    console.error('Error iniciando pago:', provider.name, e.message);
    res.status(502).json({ error: 'No se pudo iniciar el pago.' });
  }
});

// GET/POST /api/payments/webpay/return
// Retorno del navegador del comprador desde Transbank. Solo aplica al proveedor
// webpay. Está exento de la verificación CSRF porque no confía en la cookie de
// sesión: valida el pago con token_ws contra la API del proveedor.
//
// Tres casos según la documentación de Transbank:
//   1. token_ws presente        -> el pago se completó, hay que confirmar.
//   2. TBK_TOKEN presente       -> el comprador anuló antes de pagar.
//   3. Ninguno de los dos       -> timeout / conexión caída.
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

// Marca un pedido como pagado y limpia del carrito solo los productos de ese
// pedido. Es el único lugar que mueve un pedido a 'paid' — así la condición que
// habilita las descargas tiene una sola puerta de entrada.
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

module.exports = router;
module.exports.markOrderPaid = markOrderPaid;
