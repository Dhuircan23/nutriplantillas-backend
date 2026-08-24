const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// La membresía se compra como producto ('membership-mensual') y se paga por la
// misma pasarela que el resto del catálogo; markOrderPaid activa los 30 días.
// Este módulo ya no expone la activación manual: se retiró para que no exista
// una segunda vía que deje al usuario esperando confirmación de un admin.
const MONTHLY_PRICE_CLP = 2990;

router.get('/price', (req, res) => {
  res.json({ priceClp: MONTHLY_PRICE_CLP, productId: 'membership-mensual' });
});

module.exports = router;
module.exports.MONTHLY_PRICE_CLP = MONTHLY_PRICE_CLP;
