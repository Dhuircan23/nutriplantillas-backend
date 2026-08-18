// Se corre una sola vez al arrancar el servidor. En desarrollo solo avisa
// (console.warn); en producción, para los casos realmente riesgosos, corta
// el arranque por completo — es preferible que el deploy falle temprano y
// claro, a que falle confuso en medio del primer pago real de un cliente.

function validateProductionConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const problems = [];
  const warnings = [];

  if (process.env.TRANSBANK_ENV === 'production') {
    if (!process.env.TRANSBANK_COMMERCE_CODE || !process.env.TRANSBANK_API_KEY) {
      problems.push(
        'TRANSBANK_ENV=production pero faltan TRANSBANK_COMMERCE_CODE / TRANSBANK_API_KEY. ' +
          'Sin esto, el servidor intentaría cobrar en el endpoint real de Transbank usando ' +
          'credenciales de sandbox, lo que falla siempre. Completa ambas variables con las ' +
          'credenciales reales que Transbank entrega al afiliar el comercio.'
      );
    }
  }

  if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
    problems.push(
      'JWT_SECRET falta o es demasiado corto para producción (mínimo 32 caracteres). ' +
        'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }

  if (isProduction && (process.env.FRONTEND_URL || '').includes('localhost')) {
    warnings.push(
      'FRONTEND_URL sigue apuntando a localhost con NODE_ENV=production. ¿Falta actualizarla al dominio real?'
    );
  }

  if (!isProduction && process.env.COOKIE_SAME_SITE === 'none') {
    warnings.push(
      'COOKIE_SAME_SITE=none exige HTTPS (la cookie se marca "Secure" automáticamente). ' +
        'Si estás probando esto por HTTP en local, el navegador va a descartar la cookie y el login parecerá no persistir.'
    );
  }

  for (const w of warnings) console.warn('[config] Advertencia:', w);

  if (problems.length > 0) {
    console.error('[config] No se puede arrancar en producción con esta configuración:');
    for (const p of problems) console.error(' -', p);
    process.exit(1);
  }
}

module.exports = { validateProductionConfig };
