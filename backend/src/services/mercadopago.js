// Cliente de la API de Mercado Pago (Checkout Pro).
// A diferencia de Flow, autentica con un Bearer token simple — no hay firma
// HMAC ni habilitación de IP, que es lo que estaba bloqueando a Flow.
// Docs: https://www.mercadopago.cl/developers/es/reference/preferences/_checkout_preferences/post

const MP_BASE = 'https://api.mercadopago.com';

function getAccessToken() {
  const token = process.env.MP_ACCESS_TOKEN || '';
  if (!token) throw new Error('Falta MP_ACCESS_TOKEN en las variables de entorno.');
  return token;
}

async function mpRequest(path, body, method) {
  const res = await fetch(`${MP_BASE}${path}`, {
    method: method || 'GET',
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'NutriPlantillas/1.0 (+https://nutrimetria.cc)',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (e) { /* respuesta no-JSON */ }
  if (!res.ok) {
    console.error('Mercado Pago rechazó la petición:', path, res.status, raw.slice(0, 300));
    throw new Error((data && (data.message || data.error)) || `Mercado Pago respondió ${res.status}`);
  }
  return data;
}

// Crea una "preference" de Checkout Pro: MP devuelve la URL a la que se manda
// al comprador. external_reference lleva nuestro código de pedido para poder
// reconciliar la notificación después.
async function createPreference({ orderCode, title, amountClp, email, notificationUrl, returnUrl }) {
  const data = await mpRequest('/checkout/preferences', {
    items: [{
      title,
      quantity: 1,
      unit_price: Math.round(amountClp),
      currency_id: 'CLP',
    }],
    payer: email ? { email } : undefined,
    external_reference: orderCode,
    notification_url: notificationUrl,
    back_urls: {
      success: returnUrl,
      failure: returnUrl,
      pending: returnUrl,
    },
    auto_return: 'approved',
  }, 'POST');
  return { url: data.init_point, preferenceId: data.id };
}

// status del pago: 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'refunded'
async function getPayment(paymentId) {
  return await mpRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

// Busca pagos por external_reference (nuestro orderCode). Se usa cuando el
// comprador vuelve al sitio: MP manda el payment_id, pero si falta, este es
// el camino de respaldo.
async function findPaymentsByOrderCode(orderCode) {
  const data = await mpRequest(`/v1/payments/search?external_reference=${encodeURIComponent(orderCode)}`);
  return (data && data.results) || [];
}

module.exports = { createPreference, getPayment, findPaymentsByOrderCode };
