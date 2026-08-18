const express = require('express');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { resolveExistingAsset, isAllowedType, AssetError } = require('../services/assetResolver');
const { logDownloadEvent } = require('../services/auditLog');
const { canDownload } = require('../utils/orderStatus');

const router = express.Router();

// Rate limiting específico de descargas: un usuario legítimo baja un archivo
// unas pocas veces. Un atacante iterando order_item_id o tipos de archivo hace
// muchas más. Se limita por usuario autenticado (no por IP) para no castigar a
// varios clientes detrás de la misma NAT.
const downloadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? 'u' + req.user.id : req.ip),
  message: { error: 'Demasiadas descargas en poco tiempo. Espera unos minutos.' },
});

// La regla de qué estado habilita la descarga vive en utils/orderStatus.js,
// en un solo lugar: cualquier estado nuevo queda excluido por defecto.

// GET /api/downloads/:orderItemId
// GET /api/downloads/:orderItemId/:assetType   (excel | portfolio)
//
// Cadena de autorización, en este orden y sin atajos:
//   requireAuth -> el order_item existe -> el pedido es del usuario ->
//   el pedido está pagado -> queda cupo (decremento atómico) ->
//   el asset se resuelve desde el SKU dentro de secure-files/ -> stream.
//
// El cliente nunca envía un nombre de archivo ni una ruta: solo el id del item
// que compró y, opcionalmente, cuál de los dos archivos de ese producto quiere.
async function handleDownload(req, res) {
  const { orderItemId } = req.params;
  const assetType = req.params.assetType || 'excel';

  // Validación de forma antes de tocar la base: order_items.id es SERIAL.
  if (!/^\d+$/.test(String(orderItemId))) {
    await logDownloadEvent({
      userId: req.user.id,
      orderItemId: null,
      assetType,
      outcome: 'denied_bad_id',
      reason: 'orderItemId no numérico',
      req,
    });
    return res.status(400).json({ error: 'Identificador de descarga inválido.' });
  }

  if (!isAllowedType(assetType)) {
    await logDownloadEvent({
      userId: req.user.id,
      orderItemId: Number(orderItemId),
      assetType,
      outcome: 'denied_asset_type',
      reason: 'tipo de archivo fuera de la lista blanca',
      req,
    });
    return res.status(400).json({ error: 'Tipo de archivo no permitido.' });
  }

  const itemResult = await db.query(
    `SELECT oi.id, oi.downloads_allowed, oi.downloads_used,
            o.id AS order_id, o.user_id, o.status,
            p.sku
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE oi.id = $1`,
    [Number(orderItemId)]
  );
  const item = itemResult.rows[0];

  if (!item) {
    await logDownloadEvent({
      userId: req.user.id,
      orderItemId: Number(orderItemId),
      assetType,
      outcome: 'denied_not_found',
      reason: 'order_item inexistente',
      req,
    });
    return res.status(404).json({ error: 'Producto de pedido no encontrado.' });
  }

  // IDOR: el item existe pero es de otro usuario. Se responde 404, no 403, para
  // no confirmar la existencia de un id ajeno (evita enumeración).
  const isOwner = item.user_id === req.user.id;
  if (!isOwner && req.user.role !== 'admin') {
    await logDownloadEvent({
      userId: req.user.id,
      orderItemId: item.id,
      assetType,
      outcome: 'denied_not_owner',
      reason: `el item pertenece al usuario ${item.user_id}`,
      req,
    });
    return res.status(404).json({ error: 'Producto de pedido no encontrado.' });
  }

  if (!canDownload(item.status)) {
    await logDownloadEvent({
      userId: req.user.id,
      orderItemId: item.id,
      assetType,
      outcome: 'denied_unpaid',
      reason: `estado del pedido: ${item.status}`,
      req,
    });
    return res.status(402).json({ error: 'Este pedido todavía no tiene un pago confirmado.' });
  }

  // Resolver el archivo ANTES de consumir cupo: si el archivo no existe o el
  // tipo es inválido, el usuario no debe perder una descarga.
  let asset;
  try {
    asset = resolveExistingAsset(item.sku, assetType);
  } catch (e) {
    if (e instanceof AssetError) {
      await logDownloadEvent({
        userId: req.user.id,
        orderItemId: item.id,
        assetType,
        outcome: 'error_asset',
        reason: e.code,
        req,
      });
      // La ruta física nunca se filtra al cliente.
      console.error('Asset no resuelto:', e.code, 'sku:', item.sku, 'tipo:', assetType);
      return res.status(e.status).json({ error: e.message });
    }
    throw e;
  }

  // Consumo de cupo ATÓMICO. Antes era leer -> comparar -> UPDATE +1, lo que
  // permitía que dos requests simultáneas pasaran las dos el chequeo y
  // superaran el límite. Ahora el propio UPDATE es la condición: si no
  // devuelve fila, no había cupo.
  const claim = await db.query(
    `UPDATE order_items
     SET downloads_used = downloads_used + 1
     WHERE id = $1 AND downloads_used < downloads_allowed
     RETURNING downloads_used, downloads_allowed`,
    [item.id]
  );
  if (claim.rows.length === 0) {
    await logDownloadEvent({
      userId: req.user.id,
      orderItemId: item.id,
      assetType,
      outcome: 'denied_quota',
      reason: 'cupo de descargas agotado',
      req,
    });
    return res.status(403).json({ error: 'Ya usaste todas las descargas disponibles para este producto.' });
  }

  await logDownloadEvent({
    userId: req.user.id,
    orderItemId: item.id,
    assetType,
    outcome: 'allowed',
    reason: `descarga ${claim.rows[0].downloads_used}/${claim.rows[0].downloads_allowed}`,
    req,
  });

  // Stream desde el backend. El archivo nunca se convierte en un recurso
  // público ni se expone una URL permanente: no hay ruta estática que apunte a
  // secure-files/, y esta respuesta no es cacheable.
  res.setHeader('Content-Type', asset.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${asset.downloadName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const stream = fs.createReadStream(asset.absolutePath);
  let devolved = false;

  // Si el envío falla a mitad de camino, se devuelve el cupo consumido: el
  // usuario no debe pagar con una descarga un error del servidor o de la red.
  async function devolveQuota(reason) {
    if (devolved) return;
    devolved = true;
    try {
      await db.query(
        `UPDATE order_items SET downloads_used = GREATEST(downloads_used - 1, 0) WHERE id = $1`,
        [item.id]
      );
      await logDownloadEvent({
        userId: req.user.id,
        orderItemId: item.id,
        assetType,
        outcome: 'quota_refunded',
        reason,
        req,
      });
    } catch (e) {
      console.error('No se pudo devolver el cupo de descarga:', e.message);
    }
  }

  stream.on('error', (err) => {
    console.error('Error leyendo archivo protegido:', err.message);
    devolveQuota('error de lectura: ' + err.code);
    if (!res.headersSent) res.status(500).json({ error: 'No se pudo enviar el archivo.' });
    else res.destroy();
  });

  res.on('close', () => {
    if (!res.writableFinished) devolveQuota('conexión cerrada antes de terminar');
  });

  stream.pipe(res);
}

router.get('/:orderItemId', requireAuth, downloadLimiter, handleDownload);
router.get('/:orderItemId/:assetType', requireAuth, downloadLimiter, handleDownload);

module.exports = router;
