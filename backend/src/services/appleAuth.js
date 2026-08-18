const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';

const jwksClient = jwksRsa({
  jwksUri: APPLE_JWKS_URI,
  cache: true,
  cacheMaxAge: 60 * 60 * 1000, // 1 hora — Apple rota estas llaves con poca frecuencia
});

function getSigningKey(header, callback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// Verifica un ID token real de "Sign in with Apple". Comprueba firma (contra
// las llaves públicas reales de Apple), issuer, expiración, y que el
// "audience" sea exactamente nuestro APPLE_CLIENT_ID (el Services ID
// configurado en el Apple Developer Portal) — así un token válido emitido
// para OTRA aplicación no sirve para entrar acá.
function verifyAppleIdToken(idToken) {
  if (!process.env.APPLE_CLIENT_ID) {
    return Promise.reject(new Error('Falta APPLE_CLIENT_ID en las variables de entorno.'));
  }
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getSigningKey,
      { algorithms: ['RS256'], issuer: APPLE_ISSUER, audience: process.env.APPLE_CLIENT_ID },
      (err, payload) => {
        if (err) return reject(err);
        resolve({
          providerUserId: payload.sub,
          email: payload.email || null,
          // Apple manda este campo como boolean o como string 'true'/'false' según el flujo.
          emailVerified: payload.email_verified === true || payload.email_verified === 'true',
          name: null, // Apple solo entrega el nombre una vez, en el primer login, y viene del frontend, no del token
        });
      }
    );
  });
}

module.exports = { verifyAppleIdToken };
