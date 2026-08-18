// Interfaz de proveedor de pago.
//
// Existe para que la Fase 4 pueda conectar Transbank sin tocar órdenes,
// carrito, permisos ni descargas. Todo lo que el resto del backend necesita
// saber de un pago está en estos tres métodos y en los estados de orden.
//
// ESTADO ACTUAL: Transbank/Webpay NO está conectado. El proveedor activo por
// defecto es el simulado, que exige confirmación manual y nunca mueve dinero.

const { ORDER_STATUS } = require('../utils/orderStatus');

class PaymentProvider {
  get name() {
    throw new Error('PaymentProvider.name no implementado');
  }

  // Inicia un intento de pago para un pedido.
  // Devuelve { redirectUrl, token, method } — el frontend decide cómo redirigir.
  async createTransaction() {
    throw new Error('createTransaction no implementado');
  }

  // Confirma un intento contra el proveedor.
  // Devuelve { approved: boolean, providerStatus: string, raw: object }.
  async commitTransaction() {
    throw new Error('commitTransaction no implementado');
  }

  // Consulta el estado de un intento sin confirmarlo (usado por la
  // reconciliación de pedidos atascados).
  async getTransactionStatus() {
    throw new Error('getTransactionStatus no implementado');
  }
}

// Proveedor simulado. NO cobra. Deja el pedido en payment_processing y solo
// avanza a paid cuando un admin lo confirma explícitamente. Sirve para probar
// de punta a punta la cadena compra -> permiso -> descarga sin dinero real.
class ManualPaymentProvider extends PaymentProvider {
  get name() {
    return 'manual';
  }

  async createTransaction({ orderCode, amountClp }) {
    return {
      redirectUrl: null,
      token: `manual-${orderCode}`,
      method: 'manual',
      amountClp,
      instructions:
        'Pago simulado: ningún cobro se realiza. Un administrador debe confirmar el pedido para habilitar la descarga.',
    };
  }

  async commitTransaction() {
    // Un proveedor manual nunca aprueba por sí solo.
    return { approved: false, providerStatus: 'PENDING_MANUAL_CONFIRMATION', raw: {} };
  }

  async getTransactionStatus() {
    return { approved: false, providerStatus: 'PENDING_MANUAL_CONFIRMATION', raw: {} };
  }
}

// Proveedor Webpay Plus (Transbank). Envuelve el servicio que ya existía, para
// que quede detrás de la misma interfaz — pero NO es el proveedor activo por
// defecto. Requiere PAYMENT_PROVIDER=webpay explícito. Con las variables
// TRANSBANK_* vacías opera contra el sandbox de integración, nunca cobra real.
class WebpayProvider extends PaymentProvider {
  get name() {
    return 'webpay';
  }

  async createTransaction({ orderCode, amountClp, returnUrl, sessionRef }) {
    const { getWebpayTransaction } = require('./webpay');
    // buyOrder único por intento: Transbank exige uno distinto al reintentar.
    const buyOrder = `${orderCode}-${Date.now().toString().slice(-6)}`;
    const tx = getWebpayTransaction();
    const response = await tx.create(buyOrder, sessionRef, amountClp, returnUrl);
    return { redirectUrl: response.url, token: response.token, method: 'POST', buyOrder };
  }

  async commitTransaction({ token }) {
    const { getWebpayTransaction } = require('./webpay');
    const tx = getWebpayTransaction();
    const result = await tx.commit(token);
    const approved = result.response_code === 0 && result.status === 'AUTHORIZED';
    return { approved, providerStatus: result.status, raw: result };
  }

  async getTransactionStatus({ token }) {
    const { getWebpayTransaction } = require('./webpay');
    const tx = getWebpayTransaction();
    const result = await tx.status(token);
    const approved = result.response_code === 0 && result.status === 'AUTHORIZED';
    return { approved, providerStatus: result.status, raw: result };
  }
}

// Selector del proveedor activo. Cuando Transbank se apruebe para producción,
// basta con PAYMENT_PROVIDER=webpay y credenciales reales — sin tocar órdenes,
// carrito, permisos ni descargas.
const PROVIDERS = {
  manual: () => new ManualPaymentProvider(),
  webpay: () => new WebpayProvider(),
};

function getPaymentProvider() {
  const requested = (process.env.PAYMENT_PROVIDER || 'manual').toLowerCase();
  const factory = PROVIDERS[requested];
  if (!factory) {
    throw new Error(
      `PAYMENT_PROVIDER="${requested}" no está registrado. Disponibles: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  return factory();
}

module.exports = {
  PaymentProvider,
  ManualPaymentProvider,
  WebpayProvider,
  getPaymentProvider,
  ORDER_STATUS,
};
