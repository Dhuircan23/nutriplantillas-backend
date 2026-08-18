// El rol admin se asigna por allowlist de correos en el .env, no por
// heurística de texto. Compartido entre registro por contraseña y por
// Google/Apple para que ambos caminos asignen el rol exactamente igual.
function roleForEmail(email) {
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase()) ? 'admin' : 'client';
}

module.exports = { roleForEmail };
