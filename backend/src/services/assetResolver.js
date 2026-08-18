// Resuelve producto + tipo de archivo -> ruta absoluta AUTORIZADA en disco.
//
// Por qué existe este módulo (BLOCKER corregido en la Fase 3):
// downloads.js hacía `path.resolve(item.file_path)` con un valor traído de la
// base. Bastaba con que ese valor contuviera `../` (por un seed mal generado,
// un futuro editor de productos en el admin, o una inyección en la columna)
// para que el endpoint sirviera cualquier archivo del servidor, incluido .env.
// No había ninguna comprobación de que la ruta resuelta cayera dentro de
// secure-files/.
//
// Reglas que impone este módulo:
//   1. El nombre del archivo NO viene del cliente ni de la base: se deriva del
//      SKU del producto, que está validado contra una expresión estricta.
//   2. El tipo de archivo viene de una lista blanca cerrada.
//   3. La ruta final se comprueba con path.relative contra la raíz permitida.
//      Si se sale, se rechaza — sin importar cómo se construyó.
//   4. La ruta física nunca se devuelve al cliente.
const path = require('path');
const fs = require('fs');

// Raíz de los archivos protegidos. NUNCA debe montarse como estática.
const SECURE_ROOT = path.resolve(__dirname, '..', '..', 'secure-files');

// Lista blanca de tipos de archivo entregables tras una compra.
const ASSET_TYPES = {
  excel: {
    dir: 'excel',
    ext: '.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'libro Excel',
  },
  portfolio: {
    dir: 'portfolios-docx',
    ext: '.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'portafolio editable',
  },
};

// Un SKU válido es exactamente lo que emite el inventario: NMX-01, NMX-P1,
// NMX-14-INTEGRADO, NMX-14-MINSAL-UDD. Nada más. Sin puntos, sin barras, sin
// espacios, sin caracteres codificados.
const SKU_PATTERN = /^NMX-[A-Z0-9]+(?:-[A-Z]+)*$/;

class AssetError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function isAllowedType(assetType) {
  return Object.prototype.hasOwnProperty.call(ASSET_TYPES, assetType);
}

// Devuelve { absolutePath, downloadName, mime, label } o lanza AssetError.
// `sku` proviene de products.sku (columna UNIQUE alimentada por el inventario);
// aun así se valida, porque un dato de base no es un dato confiable.
function resolveAsset(sku, assetType) {
  if (!isAllowedType(assetType)) {
    throw new AssetError('ASSET_TYPE_NOT_ALLOWED', 400, 'Tipo de archivo no permitido.');
  }
  if (typeof sku !== 'string' || !SKU_PATTERN.test(sku)) {
    throw new AssetError('SKU_INVALID', 400, 'Identificador de producto inválido.');
  }

  const spec = ASSET_TYPES[assetType];
  const fileName = sku + spec.ext;

  // path.basename corta cualquier segmento de ruta que hubiera sobrevivido a
  // la validación anterior. Defensa en profundidad, no la defensa principal.
  const safeName = path.basename(fileName);
  if (safeName !== fileName) {
    throw new AssetError('PATH_TRAVERSAL', 400, 'Nombre de archivo inválido.');
  }

  const candidate = path.resolve(SECURE_ROOT, spec.dir, safeName);

  // Comprobación de contención: la única que realmente importa. Si `candidate`
  // no está por debajo de SECURE_ROOT, path.relative devuelve algo que empieza
  // con '..' o una ruta absoluta.
  const relative = path.relative(SECURE_ROOT, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AssetError('PATH_TRAVERSAL', 400, 'Ruta de archivo fuera del área permitida.');
  }

  return {
    absolutePath: candidate,
    downloadName: safeName,
    mime: spec.mime,
    label: spec.label,
  };
}

// Igual que resolveAsset pero además confirma que el archivo existe.
function resolveExistingAsset(sku, assetType) {
  const asset = resolveAsset(sku, assetType);
  if (!fs.existsSync(asset.absolutePath)) {
    throw new AssetError('ASSET_MISSING', 503, 'El archivo no está disponible en el servidor.');
  }
  return asset;
}

module.exports = {
  resolveAsset,
  resolveExistingAsset,
  isAllowedType,
  AssetError,
  ASSET_TYPES,
  SECURE_ROOT,
  SKU_PATTERN,
};
