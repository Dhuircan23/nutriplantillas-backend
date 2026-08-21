// Defensa CSRF para una API con sesión en cookie.
//
// Por qué hace falta: la sesión viaja en una cookie httpOnly y CORS está
// configurado con credentials: true. El README recomienda COOKIE_SAME_SITE=none
// cuando frontend y backend quedan en dominios distintos (el caso típico:
// GitHub Pages + Railway). Con SameSite=None, el navegador manda la cookie en
// peticiones cross-site, así que un sitio de terceros podía disparar un POST
// autenticado contra esta API — crear pedidos, vaciar el carrito — sin leer la
// respuesta. CORS no lo impide: bloquea leer la respuesta, no enviar la petición.
//
// Estrategia: para todo método que cambia estado, exigir que el Origin (o, si
// falta, el Referer) esté en la lista blanca. Un formulario cross-site no puede
// falsificar Origin, y las peticiones same-origin del propio frontend siempre
// lo traen. Es la defensa que corresponde a una API JSON sin formularios HTML
// propios, y no obliga a mantener un token de sesión extra.
const { getAllowedOrigins } = require('../utils/origins');
const { logSecurityEvent } = require('../services/auditLog');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Rutas exentas: Transbank y Flow hacen un POST/GET de retorno desde su propio
// dominio, que legítimamente no tiene un Origin de nuestra lista. Es seguro
// porque estos endpoints no confían en la cookie de sesión: validan el pago
// contra la API del proveedor usando el token que llega en la URL/body.
const EXEMPT_PATHS = [
  /^\/api\/payments\/webpay\/return$/,
  /^\/api\/payments\/flow\/return$/,
  /^\/api\/payments\/flow\/confirm$/,
];

function isExempt(path) {
  return EXEMPT_PATHS.some((re) => re.test(path));
}

function originOf(value) {
  try {
    const u = new URL(value);
    return u.origin;
  } catch (e) {
    return null;
  }
}

function verifySameOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (isExempt(req.path)) return next();

  const allowed = getAllowedOrigins();
  const origin = req.headers.origin || null;
  const referer = req.headers.referer || null;
  const candidate = origin || (referer ? originOf(referer) : null);

  if (!candidate) {
    const hasSessionCookie = !!(req.cookies && req.cookies.nmx_token);
    if (!hasSessionCookie) return next();
    logSecurityEvent('csrf_missing_origin', `${req.method} ${req.path} con cookie y sin Origin`, req);
    return res.status(403).json({ error: 'Origen de la petición no verificable.' });
  }

  if (allowed.includes(candidate)) return next();

  logSecurityEvent('csrf_bad_origin', `${req.method} ${req.path} desde ${candidate}`, req);
  return res.status(403).json({ error: 'Origen no permitido para esta operación.' });
}

module.exports = { verifySameOrigin };
