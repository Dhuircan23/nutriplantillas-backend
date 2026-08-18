const express = require('express');
const { verifyGoogleIdToken } = require('../services/googleAuth');
const { verifyAppleIdToken } = require('../services/appleAuth');
const { findOrCreateOAuthUser } = require('../services/oauthAccountLinking');
const { createSession } = require('../middleware/auth');
const { getSessionDurationMs } = require('../utils/sessionDuration');

const router = express.Router();

const sameSite = process.env.COOKIE_SAME_SITE || 'lax';
const secure = sameSite === 'none' ? true : process.env.NODE_ENV === 'production';
const COOKIE_OPTS = { httpOnly: true, secure, sameSite, maxAge: getSessionDurationMs() };

// Maneja el flujo común a Google y Apple: vincular/crear cuenta y abrir
// sesión. Separado para que ambas rutas de abajo queden idénticas y no se
// desincronicen si una se actualiza y la otra no.
async function handleOAuthLogin(provider, verified, res) {
  let result;
  try {
    result = await findOrCreateOAuthUser(provider, verified);
  } catch (e) {
    if (e.code === 'EMAIL_EXISTS_UNVERIFIED') {
      return res.status(409).json({ error: e.message });
    }
    throw e; // cualquier otro error real de la base sí debe llegar al error handler central
  }
  const token = await createSession(result.user);
  res.cookie('nmx_token', token, COOKIE_OPTS);
  res.status(200).json({ user: { email: result.user.email, role: result.user.role } });
}

// POST /api/auth/oauth/google  { idToken }
router.post('/google', async (req, res) => {
  const { idToken } = req.body || {};
  if (typeof idToken !== 'string' || !idToken) {
    return res.status(400).json({ error: 'Falta idToken.' });
  }
  let verified;
  try {
    verified = await verifyGoogleIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'No se pudo verificar la cuenta de Google.' });
  }
  await handleOAuthLogin('google', verified, res);
});

// POST /api/auth/oauth/apple  { idToken }
router.post('/apple', async (req, res) => {
  const { idToken } = req.body || {};
  if (typeof idToken !== 'string' || !idToken) {
    return res.status(400).json({ error: 'Falta idToken.' });
  }
  let verified;
  try {
    verified = await verifyAppleIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'No se pudo verificar la cuenta de Apple.' });
  }
  await handleOAuthLogin('apple', verified, res);
});

module.exports = router;
