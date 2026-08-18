require('dotenv').config();
const { validateProductionConfig } = require('./utils/validateProductionConfig');
validateProductionConfig();

const express = require('express');
// Parchea Express para que los rechazos de promesas dentro de handlers async
// lleguen solos al error handler de abajo, en vez de dejar la request colgada.
require('express-async-errors');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const oauthRoutes = require('./routes/oauth');
const productsRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const ordersRoutes = require('./routes/orders');
const paymentsRoutes = require('./routes/payments');
const downloadsRoutes = require('./routes/downloads');
const adminRoutes = require('./routes/admin');
const { reconcilePendingOrders } = require('./jobs/reconcilePendingOrders');

const { getAllowedOrigins } = require('./utils/origins');
const { verifySameOrigin } = require('./middleware/verifySameOrigin');

const app = express();

// Esta API solo devuelve JSON (nunca HTML que el navegador vaya a renderizar),
// así que se desactiva el CSP por defecto de helmet (pensado para servir
// páginas) y se deja explícito que los recursos son cross-origin, ya que el
// frontend vive en un puerto/origen distinto al de este backend.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Capa de defensa por IP contra fuerza bruta / credential stuffing,
// complementaria al bloqueo progresivo por cuenta (ver src/routes/auth.js).
// Esta corta ataques distribuidos contra muchos correos distintos desde la
// misma IP; el bloqueo por cuenta corta ataques contra un solo correo.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos desde esta red. Intenta de nuevo más tarde.' },
});

// FRONTEND_URL admite una lista separada por comas (ej. dominio con y sin
// "www", o staging + producción a la vez). Con un solo origen configurado,
// se comporta exactamente igual que antes.
const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      // Sin header Origin (ej. curl, health checks server-to-server) — permitir.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true, // necesario para que la cookie httpOnly de sesión viaje con las requests
  })
);
app.use(cookieParser());
app.use(express.json());
// Transbank redirige con application/x-www-form-urlencoded en el POST de retorno del pago.
app.use(express.urlencoded({ extended: false }));

// Defensa CSRF: toda operación que cambia estado debe venir de un origen
// permitido. Va después de cookieParser (necesita leer si hay cookie de
// sesión) y antes de las rutas. El retorno de Webpay está exento porque no se
// apoya en la cookie de sesión.
app.use(verifySameOrigin);

// Rate limiting de endpoints administrativos: son pocos, sensibles, y un
// patrón de reintentos acá casi siempre es abuso.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones administrativas. Intenta más tarde.' },
});

// Rate limiting de creación de pedidos: evita que alguien genere miles de
// pedidos 'pending' y ensucie la reconciliación.
const ordersLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados pedidos creados en poco tiempo.' },
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/oauth', authLimiter);
app.use('/api/auth/oauth', oauthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersLimiter, ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/downloads', downloadsRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// Handler de errores centralizado: evita que un throw dentro de una ruta
// async tumbe el proceso o filtre un stack trace al cliente.
app.use((err, req, res, next) => {
  // Un rechazo de CORS llega acá como error: responder 403, no 500.
  if (err && /Origen no permitido por CORS/.test(err.message || '')) {
    return res.status(403).json({ error: 'Origen no permitido.' });
  }
  // Se registra el mensaje y el stack, nunca el body ni las cabeceras (podrían
  // contener credenciales).
  console.error('Error no manejado:', err && err.message, err && err.stack);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`NutriPlantillas backend escuchando en http://localhost:${PORT}`);
});

// Red de seguridad out-of-the-box: corre la reconciliación cada 5 minutos
// mientras el proceso esté vivo. Para producción se recomienda además (o en
// vez de esto) un cron real del sistema operativo llamando a
// `npm run reconcile`, que no depende de que este proceso siga corriendo.
if (process.env.DISABLE_INPROCESS_RECONCILER !== 'true') {
  const INTERVAL_MS = 5 * 60 * 1000;
  setInterval(() => {
    reconcilePendingOrders().catch((e) => {
      console.error('Error en reconciliación automática:', e.message);
    });
  }, INTERVAL_MS);
}

module.exports = app;
