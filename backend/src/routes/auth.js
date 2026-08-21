const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const { getPrimaryFrontendUrl } = require('../utils/origins');

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

function isStrongPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 10 &&
    password.length <= 40 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

function computeLockMs(failedAttempts) {
  if (failedAttempts >= 12) return 60 * 60 * 1000;
  if (failedAttempts >= 8) return 15 * 60 * 1000;
  if (failedAttempts >= 5) return 60 * 1000;
  return null;
}

router.post('/register', async (req, res) => {
  const { email, password, name, phone } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Correo inválido.' });
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: 'La contraseña debe tener entre 10 y 40 caracteres, con al menos una mayúscula, una minúscula y un número.',
    });
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const role = roleForEmail(email);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const result = await db.query(
    'INSERT INTO users (email, password_hash, role, name, phone, verification_token, verification_sent_at) VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id, email, role',
    [
      email.toLowerCase(),
      passwordHash,
      role,
      typeof name === 'string' ? name.trim().slice(0, 120) || null : null,
      typeof phone === 'string' ? phone.trim().slice(0, 30) || null : null,
      verificationToken,
    ]
  );
  const user = result.rows[0];
  const token = await createSession(user);
  res.cookie('nmx_token', token, COOKIE_OPTS);
  const verifyUrl = `${getPrimaryFrontendUrl()}/VerifyEmail.dc.html?token=${verificationToken}`;
  sendVerificationEmail(user.email, verifyUrl).catch((e) => console.error('Error enviando correo de verificación:', e.message));
  res.status(201).json({ user: { email: user.email, role: user.role } });
});

router.get('/verify-email', async (req, res) => {
  const token = String(req.query.token || '');
  if (!token) return res.status(400).json({ error: 'Falta el token de verificación.' });
  const result = await db.query(
    'UPDATE users SET email_verified = true, verification_token = NULL WHERE verification_token = $1 RETURNING email',
    [token]
  );
  if (result.rows.length === 0) {
    return res.status(400).json({ error: 'El enlace de verificación no es válido o ya fue usado.' });
  }
  res.json({ ok: true, email: result.rows[0].email });
});

router.post('/resend-verification', requireAuth, async (req, res) => {
  const result = await db.query('SELECT email, email_verified FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (user.email_verified) return res.json({ ok: true, alreadyVerified: true });

  const verificationToken = crypto.randomBytes(32).toString('hex');
  await db.query('UPDATE users SET verification_token = $1, verification_sent_at = now() WHERE id = $2', [
    verificationToken,
    req.user.id,
  ]);
  const verifyUrl = `${getPrimaryFrontendUrl()}/VerifyEmail.dc.html?token=${verificationToken}`;
  await sendVerificationEmail(user.email, verifyUrl).catch((e) => console.error('Error enviando correo de verificación:', e.message));
  res.json({ ok: true });
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

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Correo inválido.' });

  const result = await db.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  const user = result.rows[0];
  if (user && user.password_hash) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    await db.query(
      "UPDATE users SET reset_token = $1, reset_token_expires_at = now() + interval '1 hour' WHERE id = $2",
      [resetToken, user.id]
    );
    const resetUrl = `${getPrimaryFrontendUrl()}/ResetPassword.dc.html?token=${resetToken}`;
    sendPasswordResetEmail(user.email, resetUrl).catch((e) =>
      console.error('Error enviando correo de recuperación:', e.message)
    );
  }
  res.json({ ok: true });
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'Falta el token de recuperación.' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      error: 'La contraseña debe tener entre 10 y 40 caracteres, con al menos una mayúscula, una minúscula y un número.',
    });
  }

  const result = await db.query(
    'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires_at > now()',
    [token]
  );
  const user = result.rows[0];
  if (!user) {
    return res.status(400).json({ error: 'El enlace de recuperación no es válido o ya expiró.' });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.query(
    `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL,
       failed_login_attempts = 0, locked_until = NULL
     WHERE id = $2`,
    [newHash, user.id]
  );
  res.json({ ok: true });
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
    `SELECT email, role, name, country, profession, marketing_opt_in, product_updates_opt_in, email_verified,
            membership_status, membership_expires_at, membership_discount_percent
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  const u = result.rows[0];
  const membershipActive = u.membership_status === 'active' && u.membership_expires_at && new Date(u.membership_expires_at) > new Date();
  res.json({
    user: {
      email: u.email,
      role: u.role,
      name: u.name || '',
      country: u.country || '',
      profession: u.profession || '',
      marketingOptIn: u.marketing_opt_in,
      productUpdatesOptIn: u.product_updates_opt_in,
      emailVerified: u.email_verified,
      membershipStatus: membershipActive ? 'active' : (u.membership_status === 'pending' ? 'pending' : 'none'),
      membershipExpiresAt: u.membership_expires_at,
      membershipDiscountPercent: u.membership_discount_percent,
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
