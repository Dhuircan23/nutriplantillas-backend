const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const {
  createSession,
  requireAuth,
  decodeTokenUnsafe,
  revokeSession,
  revokeAllSessions,
} = require('../middleware/auth');
const { getSessionDurationMs } = require('../utils/sessionDuration');
const { roleForEmail } = require('../utils/roleForEmail');

const router = express.Router();

const sameSite = process.env.COOKIE_SAME_SITE || 'lax';
const secure = sameSite === 'none' ? true : process.env.NODE_ENV === 'production';

const COOKIE_OPTS = {
  httpOnly: true,
  secure,
  sameSite,
  maxAge: getSessionDurationMs(),
};

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function computeLockMs(failedAttempts) {
  if (failedAttempts >= 12) return 60 * 60 * 1000;
  if (failedAttempts >= 8) return 15 * 60 * 1000;
  if (failedAttempts >= 5) return 60 * 1000;
  return null;
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Correo inválido.' });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const role = roleForEmail(email);
  const result = await db.query(
    'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
    [email.toLowerCase(), passwordHash, role]
  );
  const user = result.rows[0];
  const token = await createSession(user);
  res.cookie('nmx_token', token, COOKIE_OPTS);
  res.status(201).json({ user: { email: user.email, role: user.role } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'Correo o contraseña inválidos.' });
  }

  const result = await db.query(
    `SELECT id, email, password_hash, role, failed_login_attempts, locked_until
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  const user = result.rows[0];
  const genericError = { error: 'Correo o contraseña incorrectos.' };
  if (!user) return res.status(401).json(genericError);

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    return res.status(429).json({
      error: `Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en ${minutesLeft} minuto(s).`,
    });
  }

  if (!user.password_hash) {
    return res.status(401).json({
      error: 'Esta cuenta se creó con Google o Apple. Inicia sesión con ese mismo método.',
    });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const attempts = user.failed_login_attempts + 1;
    const lockMs = computeLockMs(attempts);
    const lockedUntil = lockMs ? new Date(Date.now() + lockMs) : null;
    await db.query('UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3', [
      attempts,
      lockedUntil,
      user.id,
    ]);
    return res.status(401).json(genericError);
  }

  await db.query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
    [user.id]
  );

  const token = await createSession(user);
  res.cookie('nmx_token', token, COOKIE_OPTS);
  res.json({ user: { email: user.email, role: user.role } });
});

router.post('/logout', async (req, res) => {
  const payload = decodeTokenUnsafe(req);
  if (payload && payload.sid) await revokeSession(payload.sid);
  res.clearCookie('nmx_token', { ...COOKIE_OPTS, maxAge: undefined });
  res.json({ ok: true });
});

router.post('/logout-all', requireAuth, async (req, res) => {
  await revokeAllSessions(req.user.id);
  res.clearCookie('nmx_token', { ...COOKIE_OPTS, maxAge: undefined });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT email, role, name, country, profession, marketing_opt_in, product_updates_opt_in
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  const u = result.rows[0];
  res.json({
    user: {
      email: u.email,
      role: u.role,
      name: u.name || '',
      country: u.country || '',
      profession: u.profession || '',
      marketingOptIn: u.marketing_opt_in,
      productUpdatesOptIn: u.product_updates_opt_in,
    },
  });
});

router.patch('/me', requireAuth, async (req, res) => {
  const { name, country, profession, marketingOptIn, productUpdatesOptIn } = req.body || {};
  if (name !== undefined && (typeof name !== 'string' || name.length > 120)) {
    return res.status(400).json({ error: 'Nombre inválido.' });
  }
  if (country !== undefined && (typeof country !== 'string' || country.length > 80)) {
    return res.status(400).json({ error: 'País inválido.' });
  }
  if (profession !== undefined && (typeof profession !== 'string' || profession.length > 120)) {
    return res.status(400).json({ error: 'Profesión inválida.' });
  }

  await db.query(
    `UPDATE users SET
       name = COALESCE($1, name),
       country = COALESCE($2, country),
       profession = COALESCE($3, profession),
       marketing_opt_in = COALESCE($4, marketing_opt_in),
       product_updates_opt_in = COALESCE($5, product_updates_opt_in)
     WHERE id = $6`,
    [
      name !== undefined ? name.trim() : null,
      country !== undefined ? country.trim() : null,
      profession !== undefined ? profession.trim() : null,
      typeof marketingOptIn === 'boolean' ? marketingOptIn : null,
      typeof productUpdatesOptIn === 'boolean' ? productUpdatesOptIn : null,
      req.user.id,
    ]
  );
  res.json({ ok: true });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const hash = result.rows[0] && result.rows[0].password_hash;
  if (!hash) {
    return res.status(400).json({
      error: 'Esta cuenta se creó con Google o Apple y no tiene contraseña propia.',
    });
  }

  const ok = await bcrypt.compare(String(currentPassword || ''), hash);
  if (!ok) return res.status(401).json({ error: 'La contraseña actual no es correcta.' });

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
module.exports.computeLockMs = computeLockMs;
