// Envío del correo de verificación. Usa SMTP real si SMTP_HOST está configurado
// (Gmail, Resend, SendGrid SMTP, etc. — cualquier proveedor sirve, solo cambian
// host/puerto/usuario/clave). Sin esas variables, NO falla el registro: solo
// deja el enlace en el log del servidor, para poder probar el flujo sin
// credenciales de correo todavía.
let nodemailer;
try { nodemailer = require('nodemailer'); } catch (e) { /* no instalado todavía */ }

function getTransport() {
  if (!nodemailer || !process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendVerificationEmail(toEmail, verifyUrl) {
  const transport = getTransport();
  if (!transport) {
    console.log(`[email no configurado] Enlace de verificación para ${toEmail}: ${verifyUrl}`);
    return { sent: false };
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Verifica tu correo — NutriPlantillas',
    html: `<p>Gracias por registrarte en NutriPlantillas.</p>
           <p>Verifica tu correo para activar tu cuenta:</p>
           <p><a href="${verifyUrl}">${verifyUrl}</a></p>
           <p>Si no creaste esta cuenta, ignora este correo.</p>`,
  });
  return { sent: true };
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };

// isNew = la cuenta no tenía contraseña (creada con Google/Apple), así que el
// correo habla de crear una, no de restablecerla.
async function sendPasswordResetEmail(toEmail, resetUrl, isNew) {
  const transport = getTransport();
  if (!transport) {
    console.log(`[email no configurado] Enlace de recuperación para ${toEmail}: ${resetUrl}`);
    return { sent: false };
  }
  const subject = isNew
    ? 'Crea tu contraseña — NutriPlantillas'
    : 'Recupera tu contraseña — NutriPlantillas';
  const intro = isNew
    ? '<p>Tu cuenta se creó con Google, así que todavía no tiene contraseña propia.</p><p>Si quieres crear una para poder entrar también con correo y contraseña, haz clic en el siguiente enlace (válido por 1 hora):</p>'
    : '<p>Recibimos una solicitud para restablecer tu contraseña en NutriPlantillas.</p><p>Si fuiste tú, haz clic en el siguiente enlace (válido por 1 hora):</p>';
  const outro = isNew
    ? '<p>Si no fuiste tú, ignora este correo: podrás seguir entrando con Google normalmente.</p>'
    : '<p>Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.</p>';
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject,
    html: `${intro}<p><a href="${resetUrl}">${resetUrl}</a></p>${outro}`,
  });
  return { sent: true };
}
