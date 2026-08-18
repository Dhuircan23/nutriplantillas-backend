const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verifica un ID token real de Google Identity Services. La librería oficial
// se encarga de: validar la firma contra las llaves públicas de Google,
// comprobar que no esté vencido, y comprobar que el "audience" (aud) sea
// exactamente nuestro GOOGLE_CLIENT_ID — así un token válido emitido para
// OTRA aplicación no sirve para entrar acá.
async function verifyGoogleIdToken(idToken) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Falta GOOGLE_CLIENT_ID en las variables de entorno.');
  }
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return {
    providerUserId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name || null,
  };
}

module.exports = { verifyGoogleIdToken };
