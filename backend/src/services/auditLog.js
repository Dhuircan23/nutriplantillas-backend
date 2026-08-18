// Registro de auditoría. Guarda QUÉ pasó y POR QUÉ, sin guardar NUNCA
// contraseñas, tokens, cookies, secretos ni cabeceras de autorización.
//
// Los eventos de descarga se persisten en la tabla download_events porque son
// la evidencia de la cadena compra -> permiso -> entrega, y hacen falta para
// investigar un "pagué y no puedo descargar" o un intento de abuso.
// El resto de eventos van al log del proceso.
const db = require('../db');

// Cabeceras que jamás se registran.
const FORBIDDEN = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'proxy-authorization']);

function safeContext(req) {
  if (!req) return {};
  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (FORBIDDEN.has(k.toLowerCase())) continue;
    if (k.toLowerCase() === 'user-agent') headers.userAgent = String(v).slice(0, 200);
  }
  return { ip: req.ip, userAgent: headers.userAgent || null };
}

async function logDownloadEvent({ userId, orderItemId, assetType, outcome, reason, req }) {
  const ctx = safeContext(req);
  const allowed = outcome === 'allowed';
  // Los intentos denegados se dejan también en el log del proceso, para que un
  // patrón de abuso sea visible sin consultar la base.
  if (!allowed) {
    console.warn(
      `[download:${outcome}] user=${userId} item=${orderItemId} asset=${assetType} motivo="${reason}" ip=${ctx.ip}`
    );
  }
  try {
    await db.query(
      `INSERT INTO download_events (user_id, order_item_id, asset_type, outcome, reason, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId || null, orderItemId || null, assetType || null, outcome, reason || null, ctx.ip || null, ctx.userAgent]
    );
  } catch (e) {
    // Un fallo del log no debe romper ni autorizar la request.
    console.error('No se pudo escribir download_events:', e.message);
  }
}

// Eventos de seguridad que no necesitan consulta histórica: solo log.
function logSecurityEvent(event, detail, req) {
  const ctx = safeContext(req);
  console.warn(`[security:${event}] ${detail} ip=${ctx.ip}`);
}

module.exports = { logDownloadEvent, logSecurityEvent };
