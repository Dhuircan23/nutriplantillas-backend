const jwt = require('jsonwebtoken');
const db = require('../db');
const { getSessionDurationMs } = require('../utils/sessionDuration');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en las variables de entorno (ver .env.example).');
}

// Crea la sesión en la base (la fuente real de verdad para poder revocar) y
// devuelve el JWT firmado que la referencia por su "sid". El JWT por sí solo
// ya no alcanza para estar autenticado: requireAuth también valida que esta
// fila siga existiendo, sin revocar y sin vencer.
async function createSession(user) {
  // Limpieza liviana: al loguearse, se descartan las sesiones ya vencidas de
  // este mismo usuario, para que la tabla no crezca sin límite por usuario activo.
  await db.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at < now()', [user.id]);

  const expiresAt = new Date(Date.now() + getSessionDurationMs());
  const result = await db.query(
    'INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id',
    [user.id, expiresAt]
  );
  const sessionId = result.rows[0].id;

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, sid: sessionId },
    JWT_SECRET,
    { expiresIn: Math.floor(getSessionDurationMs() / 1000) }
  );
  return token;
}

function readToken(req) {
  if (req.cookies && req.cookies.nmx_token) return req.cookies.nmx_token;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// Decodifica el token sin exigir que la sesión siga viva — solo lo usa logout,
// para poder revocar la sesión referenciada aunque, por ejemplo, ya haya vencido.
function decodeTokenUnsafe(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Lee, valida la firma, y además confirma en la base que la sesión sigue
// activa. Devuelve el usuario o null. No escribe la respuesta.
async function verifyRequest(req) {
  const token = readToken(req);
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
  if (!payload.sid) return null; // token viejo emitido antes de la Fase B, ya no es válido

  const result = await db.query(
    `SELECT id FROM sessions
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
    [payload.sid, payload.sub]
  );
  if (result.rows.length === 0) return null;

  return { id: payload.sub, email: payload.email, role: payload.role, sessionId: payload.sid };
}

// Exige sesión válida y no revocada. Si pasa, deja al usuario en req.user.
async function requireAuth(req, res, next) {
  const user = await verifyRequest(req);
  if (!user) return res.status(401).json({ error: 'No autenticado o sesión expirada.' });
  req.user = user;
  next();
}

// Igual que requireAuth, pero además exige rol admin.
async function requireAdmin(req, res, next) {
  const user = await verifyRequest(req);
  if (!user) return res.status(401).json({ error: 'No autenticado o sesión expirada.' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Requiere rol de administrador.' });
  req.user = user;
  next();
}

async function revokeSession(sessionId) {
  if (!sessionId) return;
  await db.query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [
    sessionId,
  ]);
}

async function revokeAllSessions(userId) {
  await db.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
    userId,
  ]);
}

module.exports = {
  createSession,
  requireAuth,
  requireAdmin,
  decodeTokenUnsafe,
  revokeSession,
  revokeAllSessions,
};
