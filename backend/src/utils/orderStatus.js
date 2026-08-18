// Estados de pedido y la única regla que decide si se puede descargar.
//
// Regla: solo 'paid' habilita la descarga. Cualquier estado nuevo que se agregue
// queda excluido por defecto — hay que sumarlo explícitamente a DOWNLOADABLE.
const ORDER_STATUS = {
  PENDING: 'pending',
  PAYMENT_PROCESSING: 'payment_processing',
  AUTHORIZED: 'authorized',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

const ALL_STATUSES = Object.values(ORDER_STATUS);

// Estados que habilitan la descarga de archivos protegidos.
const DOWNLOADABLE = [ORDER_STATUS.PAID];

// Estados desde los que un intento de pago puede iniciarse.
const PAYABLE = [ORDER_STATUS.PENDING, ORDER_STATUS.FAILED];

function canDownload(status) {
  return DOWNLOADABLE.includes(status);
}

function canStartPayment(status) {
  return PAYABLE.includes(status);
}

module.exports = { ORDER_STATUS, ALL_STATUSES, DOWNLOADABLE, PAYABLE, canDownload, canStartPayment };
