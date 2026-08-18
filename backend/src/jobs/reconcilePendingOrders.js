// Reconciliación de pedidos 'pending' — Fase A del roadmap full-stack.
//
// Problema que resuelve: si el servidor se cae o pierde conexión a la base
// justo entre el commit() exitoso contra Transbank y el UPDATE del pedido a
// 'paid' (ver src/routes/payments.js), el pedido queda invisible en 'pending'
// para siempre aunque el cliente sí haya pagado. Este job barre esos pedidos
// y les pregunta a Transbank cuál es su estado real.
//
// Se puede ejecutar de dos formas:
//   1. Como script standalone (para cron real):  npm run reconcile
//   2. En proceso, con un setInterval liviano (ver src/server.js) — sirve
//      como red de seguridad out-of-the-box, pero en producción se recomienda
//      la opción 1 vía cron del sistema o un scheduler administrado, para que
//      no dependa de que el proceso web nunca se reinicie.

require('dotenv').config();
const db = require('../db');
const { getPaymentProvider } = require('../services/paymentProvider');

// Cuánto esperar desde la creación del pedido antes de considerarlo
// "atascado". Evita competir con un pago que el usuario todavía está
// completando activamente en Webpay.
const GRACE_PERIOD_MINUTES = parseInt(process.env.RECONCILE_GRACE_MINUTES || '10', 10);

// Traduce la respuesta del proveedor de pago (o su ausencia) a una decisión.
// Función pura, sin I/O, para poder probarla con datos de ejemplo.
// `outcome` es la forma normalizada del PaymentProvider: { approved, providerStatus }.
function decideOutcome({ hasToken, outcome, statusError }) {
  if (!hasToken) {
    // El pedido se creó pero el usuario nunca llegó a iniciar el pago
    // (nunca se llamó /init). No hay nada que consultarle al proveedor.
    return { newStatus: 'cancelled', reason: 'sin token de pago asociado' };
  }
  if (statusError) {
    // Un token vencido o no encontrado también cuenta como "nunca se completó":
    // los proveedores expiran los tokens no usados.
    return { newStatus: 'failed', reason: `error consultando estado: ${statusError}` };
  }
  if (outcome && outcome.approved) {
    return { newStatus: 'paid', reason: `el proveedor confirma ${outcome.providerStatus}` };
  }
  return { newStatus: 'failed', reason: `el proveedor reporta status=${outcome && outcome.providerStatus}` };
}

async function reconcilePendingOrders() {
  const client = await db.pool.connect();
  const summary = { checked: 0, recovered: 0, failed: 0, cancelled: 0, errors: 0, skipped: 0 };

  const provider = getPaymentProvider();

  try {
    const stuck = await client.query(
      `SELECT id, order_code, webpay_token, user_id
       FROM orders
       WHERE status = 'pending'
         AND created_at < now() - ($1 || ' minutes')::interval
       ORDER BY created_at ASC
       LIMIT 200`,
      [GRACE_PERIOD_MINUTES]
    );

    for (const order of stuck.rows) {
      summary.checked += 1;
      let outcome = null;
      let statusError = null;

      // El proveedor manual no tiene nada que consultar: un pedido manual solo
      // avanza cuando un admin lo confirma. Se deja intacto en vez de
      // cancelarlo por inactividad.
      if (provider.name === 'manual') {
        summary.skipped += 1;
        continue;
      }

      if (order.webpay_token) {
        try {
          outcome = await provider.getTransactionStatus({ token: order.webpay_token });
        } catch (e) {
          statusError = e.message || 'error desconocido';
        }
      }

      const { newStatus, reason } = decideOutcome({
        hasToken: !!order.webpay_token,
        outcome,
        statusError,
      });

      // WHERE status='pending' es a propósito: si el pedido cambió de estado
      // justo mientras este job corría (ej. el usuario completó el pago por
      // el camino normal en paralelo), esta UPDATE no hace nada — no pisa un
      // estado más reciente y correcto.
      const result = await client.query(
        `UPDATE orders
         SET status = $1,
             paid_at = CASE WHEN $1 = 'paid' THEN now() ELSE paid_at END,
             reconciliation_checked_at = now()
         WHERE id = $2 AND status = 'pending'
         RETURNING id`,
        [newStatus, order.id]
      );

      if (result.rows.length === 0) {
        // Ya no estaba 'pending' — otro camino lo resolvió primero, no hay nada que hacer.
        continue;
      }

      if (newStatus === 'paid') {
        // Igual que en payments.js: recién acá se limpia el carrito, porque
        // recién acá se confirma de verdad que el pago fue exitoso.
        const items = await client.query('SELECT product_id FROM order_items WHERE order_id = $1', [
          order.id,
        ]);
        const productIds = items.rows.map((r) => r.product_id);
        if (productIds.length > 0) {
          await client.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = ANY($2)', [
            order.user_id,
            productIds,
          ]);
        }
        summary.recovered += 1;
        console.warn(`[reconcile] Pedido ${order.order_code} recuperado como 'paid' (${reason}).`);
      } else if (newStatus === 'cancelled') {
        summary.cancelled += 1;
      } else {
        summary.failed += 1;
        console.warn(`[reconcile] Pedido ${order.order_code} marcado 'failed' (${reason}).`);
      }
    }
  } catch (e) {
    summary.errors += 1;
    console.error('[reconcile] Error corriendo la reconciliación:', e.message);
  } finally {
    client.release();
  }

  return summary;
}

// Permite correrlo como script suelto: node src/jobs/reconcilePendingOrders.js
if (require.main === module) {
  reconcilePendingOrders()
    .then((summary) => {
      console.log('[reconcile] Resultado:', summary);
      process.exit(0);
    })
    .catch((e) => {
      console.error('[reconcile] Falló:', e);
      process.exit(1);
    });
}

module.exports = { reconcilePendingOrders, decideOutcome, GRACE_PERIOD_MINUTES };
