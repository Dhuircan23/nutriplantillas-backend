const db = require('../db');
const { roleForEmail } = require('../utils/roleForEmail');

// verified = { providerUserId, email, emailVerified, name }
// Devuelve { user, isNewAccount, linkedToExisting }.
async function findOrCreateOAuthUser(provider, verified) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. ¿Ya existe esta identidad exacta (mismo proveedor + mismo id de Google/Apple)?
    const existingIdentity = await client.query(
      `SELECT u.id, u.email, u.role
       FROM oauth_identities oi JOIN users u ON u.id = oi.user_id
       WHERE oi.provider = $1 AND oi.provider_user_id = $2`,
      [provider, verified.providerUserId]
    );
    if (existingIdentity.rows.length > 0) {
      await client.query('COMMIT');
      return { user: existingIdentity.rows[0], isNewAccount: false, linkedToExisting: false };
    }

    // 2. Si el proveedor confirma el email como verificado, se permite vincular
    // a una cuenta ya existente con ese mismo email (ej. alguien que ya tenía
    // cuenta con contraseña y ahora entra con Google por primera vez). Si el
    // email NO viene verificado, nunca se vincula a una cuenta preexistente
    // — eso abriría la puerta a que alguien reclame la cuenta de otra persona
    // con un email no confirmado.
    if (verified.emailVerified && verified.email) {
      const existingUser = await client.query(
        'SELECT id, email, role FROM users WHERE email = $1',
        [verified.email.toLowerCase()]
      );
      if (existingUser.rows.length > 0) {
        const user = existingUser.rows[0];
        await client.query(
          `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email)
           VALUES ($1, $2, $3, $4)`,
          [user.id, provider, verified.providerUserId, verified.email]
        );
        await client.query('COMMIT');
        return { user, isNewAccount: false, linkedToExisting: true };
      }
    }

    // 3. No existe la identidad. Antes de crear cuenta nueva, hay que revisar
    // si ya existe una cuenta con este email (sin importar si el proveedor lo
    // marcó como verificado) — si existe, no se puede ni vincular (no está
    // verificado, ver punto 2) ni crear una cuenta duplicada (el email es
    // único). Se corta acá con un error claro en vez de reventar contra la
    // restricción UNIQUE de la tabla.
    if (!verified.email) {
      throw new Error('El proveedor no entregó un correo — no se puede crear la cuenta.');
    }
    const anyExisting = await client.query('SELECT id FROM users WHERE email = $1', [
      verified.email.toLowerCase(),
    ]);
    if (anyExisting.rows.length > 0) {
      const err = new Error(
        `Ya existe una cuenta con ${verified.email}, pero el proveedor no confirmó ese correo como verificado. Inicia sesión con tu contraseña, o verifica el correo en tu cuenta de ${provider === 'google' ? 'Google' : 'Apple'} y vuelve a intentar.`
      );
      err.code = 'EMAIL_EXISTS_UNVERIFIED';
      throw err;
    }

    // 4. No existe ni la identidad ni una cuenta con ese email: crear cuenta nueva.
    const newUser = await client.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, NULL, $2)
       RETURNING id, email, role`,
      [verified.email.toLowerCase(), roleForEmail(verified.email)]
    );
    const user = newUser.rows[0];
    await client.query(
      `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email)
       VALUES ($1, $2, $3, $4)`,
      [user.id, provider, verified.providerUserId, verified.email]
    );
    await client.query('COMMIT');
    return { user, isNewAccount: true, linkedToExisting: false };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { findOrCreateOAuthUser };
