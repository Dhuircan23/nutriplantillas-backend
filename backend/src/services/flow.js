// Cliente de la API de Flow (https://www.flow.cl/docs/api.html).
// Firma cada request con HMAC-SHA256 usando el secretKey del comercio, como
// exige Flow — nunca se manda el secretKey en la red, solo la firma.
const crypto = require('crypto');

const FLOW_BASE = {
  integration: 'https://sandbox.flow.cl/api',
  production: 'https://www.flow.cl/api',
};

function getConfig() {
  const env = (process.env.FLOW_ENV || 'integration').toLowerCase();
  return {
    apiKey: process.env.FLOW_API_KEY || '',
    secretKey: process.env.FLOW_SECRET_KEY || '',
    baseUrl: FLOW_BASE[env] || FLOW_BASE.integration,
  };
}

function sign(params, secretKey) {
  const keys = Object.keys(params).filter((k) => k !== 's').sort();
  const toSign = keys.map((k) => `${k}${params[k]}`).join('');
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}

async function flowRequest(path, params, method) {
  const { apiKey, secretKey, baseUrl } = getConfig();
  if (!apiKey || !secretKey) {
    throw new Error('Falta FLOW_API_KEY o FLOW_SECRET_KEY en las variables de entorno.');
  }
  const full = { ...params, apiKey };
  full.s = sign(full, secretKey);
  const body = new URLSearchParams(full);
  const url = method === 'GET' ? `${baseUrl}${path}?${body.toString()}` : `${baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    // Flow está detrás de un WAF que rechaza con 403 (y sin cuerpo JSON) las
    // peticiones sin User-Agent — el fetch de Node no manda uno por defecto.
    headers: {
      'User-Agent': 'NutriPlantillas/1.0 (+https://nutrimetria.cc)',
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? body : undefined,
  });
  const raw = await res.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (e) { /* Flow devolvió HTML, no JSON */ }
  if (!res.ok) {
    // Se registra el cuerpo crudo: un 403 sin JSON casi siempre es el WAF, no
    // la API, y sin ver el texto los dos casos se confunden.
    console.error('Flow rechazó la petición:', path, res.status, raw.slice(0, 300));
    throw new Error((data && data.message) || `Flow respondió ${res.status}`);
  }
  return data;
}

// Crea el pago. Flow exige CLP como entero (sin decimales) y un correo del pagador.
async function createPayment({ commerceOrder, subject, amountClp, email, urlConfirmation, urlReturn }) {
  const data = await flowRequest('/payment/create', {
    commerceOrder,
    subject,
    currency: 'CLP',
    amount: Math.round(amountClp),
    email,
    urlConfirmation,
    urlReturn,
  }, 'POST');
  return { url: data.url, token: data.token, flowOrder: data.flowOrder };
}

// status: 1 pendiente, 2 pagada, 3 rechazada, 4 anulada.
async function getStatus(token) {
  return await flowRequest('/payment/getStatus', { token }, 'GET');
}

module.exports = { createPayment, getStatus };
