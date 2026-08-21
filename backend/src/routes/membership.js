const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MONTHLY_PRICE_CLP = 2990;

// POST /api/membership/subscribe
// No hay Transbank conectado, así que esto NO cobra: deja la solicitud en
// 'pending' y un admin la confirma a mano (POST /api/admin/memberships/:userId/confirm),
// igual que el flujo manual de pago de pedidos.
router.post('/subscribe', async (req, res) => {
  const result = await db.query('SELECT membership_status, membership_expires_at FROM users WHERE id = $1', [req.user.id]);
  const u = result.rows[0];
  const stillActive = u.membership_status === 'active' && u.membership_expires_at && new Date(u.membership_expires_at) > new Date();
  if (stillActive) {
    return res.status(409).json({ error: 'Ya tienes una membresía activa.' });
  }
  await db.query(
    "UPDATE users SET membership_status = 'pending', membership_requested_at = now() WHERE id = $1",
    [req.user.id]
  );
  res.json({ ok: true, priceClp: MONTHLY_PRICE_CLP });
});

module.exports = router;
module.exports.MONTHLY_PRICE_CLP = MONTHLY_PRICE_CLP;
