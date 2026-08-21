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

module.exports = { sendVerificationEmail };
