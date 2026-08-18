// FRONTEND_URL admite una lista separada por comas (ej. dominio con y sin
// "www", o staging + producción). Este helper centraliza cómo se interpreta,
// para que CORS (que necesita la lista completa) y las redirecciones de pago
// (que necesitan un único destino) no se desincronicen.

function getAllowedOrigins() {
  return (process.env.FRONTEND_URL || 'http://localhost:5500')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

// El primero de la lista es el destino "canónico" para redirecciones del
// servidor (ej. de vuelta desde Webpay) — no tiene sentido elegir entre
// varios ahí, así que se usa siempre el primero configurado.
function getPrimaryFrontendUrl() {
  return getAllowedOrigins()[0];
}

module.exports = { getAllowedOrigins, getPrimaryFrontendUrl };
