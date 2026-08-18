// Pruebas de ATAQUE al resolutor de archivos protegidos.
// Corren sin base de datos y sin servidor: `npm run test:unit`
//
// Este es el archivo que demuestra que el BLOCKER de path traversal quedó
// cerrado. Cada caso es un intento real de salir de secure-files/.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const {
  resolveAsset,
  isAllowedType,
  AssetError,
  SECURE_ROOT,
} = require('../src/services/assetResolver');

// Todo lo que un atacante podría intentar meter donde va un SKU.
const TRAVERSAL_PAYLOADS = [
  '../.env',
  '../../.env',
  '../../../etc/passwd',
  '..%2F.env',
  '%2e%2e/.env',
  '%2e%2e%2f%2e%2e%2f.env',
  '....//.env',
  '..\\..\\.env',
  '/etc/passwd',
  'C:\\Windows\\win.ini',
  'NMX-01/../../../.env',
  'NMX-01%00.env',
  'NMX-01\n../.env',
  '.',
  '..',
  '',
  'NMX-01.xlsx',           // ya trae extensión: no es un SKU
  'nmx-01',                // minúsculas: no es un SKU
  'NMX-01 ',               // espacio final
  './NMX-01',
  'secure-files/excel/NMX-01',
];

test('todo intento de path traversal en el SKU se rechaza', () => {
  for (const payload of TRAVERSAL_PAYLOADS) {
    assert.throws(
      () => resolveAsset(payload, 'excel'),
      (err) => err instanceof AssetError && ['SKU_INVALID', 'PATH_TRAVERSAL'].includes(err.code),
      `NO se rechazó el payload: ${JSON.stringify(payload)}`
    );
  }
});

test('los tipos de archivo fuera de la lista blanca se rechazan', () => {
  for (const bad of ['env', 'audit', 'master', '../audit', 'excel/../audit', '', null, undefined, 'EXCEL']) {
    assert.throws(
      () => resolveAsset('NMX-01', bad),
      (err) => err instanceof AssetError && err.code === 'ASSET_TYPE_NOT_ALLOWED',
      `NO se rechazó el tipo: ${JSON.stringify(bad)}`
    );
  }
});

test('un SKU que no es string se rechaza', () => {
  for (const bad of [null, undefined, 42, {}, [], true, { toString: () => 'NMX-01' }]) {
    assert.throws(() => resolveAsset(bad, 'excel'), AssetError);
  }
});

test('toda ruta resuelta queda contenida en secure-files/', () => {
  const skus = ['NMX-01', 'NMX-P1', 'NMX-14-INTEGRADO', 'NMX-14-MINSAL-UDD', 'NMX-28-PACK'];
  for (const sku of skus) {
    for (const type of ['excel', 'portfolio']) {
      const { absolutePath } = resolveAsset(sku, type);
      const rel = path.relative(SECURE_ROOT, absolutePath);
      assert.ok(rel && !rel.startsWith('..') && !path.isAbsolute(rel), `${sku}/${type} se sale de la raíz`);
      assert.ok(absolutePath.startsWith(SECURE_ROOT + path.sep), `${sku}/${type} no está bajo SECURE_ROOT`);
    }
  }
});

test('el nombre de descarga se deriva del SKU, nunca del cliente', () => {
  assert.strictEqual(resolveAsset('NMX-01', 'excel').downloadName, 'NMX-01.xlsx');
  assert.strictEqual(resolveAsset('NMX-01', 'portfolio').downloadName, 'NMX-01.docx');
  assert.strictEqual(resolveAsset('NMX-14-MINSAL-UDD', 'excel').downloadName, 'NMX-14-MINSAL-UDD.xlsx');
});

test('los archivos de auditoría y el maestro NO son alcanzables por el resolutor', () => {
  // audit/ y master/ existen en disco pero no están en la lista blanca:
  // ningún cliente puede pedirlos por más que adivine el nombre.
  for (const type of ['audit', 'master', 'auditoria', 'maestro']) {
    assert.strictEqual(isAllowedType(type), false, `${type} no debería ser un tipo permitido`);
  }
});
