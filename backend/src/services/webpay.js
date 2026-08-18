const { WebpayPlus, IntegrationCommerceCodes, IntegrationApiKeys } = require('transbank-sdk');

// Si no se configuran credenciales propias en .env, cae a las credenciales
// públicas de INTEGRACIÓN (sandbox) que trae el SDK oficial de Transbank.
// Para producción hay que setear TRANSBANK_COMMERCE_CODE / TRANSBANK_API_KEY
// con las credenciales reales entregadas por Transbank al afiliarse, y usar
// buildForProduction en vez de buildForIntegration.
function getWebpayTransaction() {
  const commerceCode = process.env.TRANSBANK_COMMERCE_CODE || IntegrationCommerceCodes.WEBPAY_PLUS;
  const apiKey = process.env.TRANSBANK_API_KEY || IntegrationApiKeys.WEBPAY;
  const isProduction = process.env.TRANSBANK_ENV === 'production';
  return isProduction
    ? WebpayPlus.Transaction.buildForProduction(commerceCode, apiKey)
    : WebpayPlus.Transaction.buildForIntegration(commerceCode, apiKey);
}

module.exports = { getWebpayTransaction };
