// Fuente única de verdad para cuánto dura una sesión — la usan el JWT, la
// fila en `sessions`, y el maxAge de la cookie. Antes esto vivía duplicado
// (una constante en el middleware, otra en routes/auth.js); centralizarlo
// evita que se desincronicen.
//
// Por defecto son 3650 días (~10 años) — en la práctica "no caduca", a
// pedido explícito del negocio. Nótese el trade-off: una sesión que dura
// años sigue siendo revocable (logout / logout-all la invalidan de
// inmediato, ver src/middleware/auth.js), pero si el dispositivo de alguien
// es robado y nadie revoca la sesión a mano, ese acceso queda vivo mucho
// tiempo. Si más adelante se quiere volver a una expiración corta, basta con
// bajar SESSION_DURATION_DAYS — no hay que tocar ningún otro archivo.
function getSessionDurationMs() {
  const days = parseInt(process.env.SESSION_DURATION_DAYS || '3650', 10);
  return days * 24 * 60 * 60 * 1000;
}

module.exports = { getSessionDurationMs };
