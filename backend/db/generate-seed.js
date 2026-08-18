// Genera db/seed.sql desde nutrimetria-inventory.js — la FUENTE DE DATOS UNICA.
// No edites seed.sql a mano: edita el inventario y vuelve a correr `node db/generate-seed.js`.
// Asi el catalogo del frontend y la tabla products nunca se desincronizan.
const fs = require('fs');
const path = require('path');

const invPath = path.join(__dirname, '..', '..', 'nutrimetria-inventory.js');
const src = fs.readFileSync(invPath, 'utf8');
const sandbox = {};
new Function('globalThis', 'window', src)(sandbox, undefined);
const inv = sandbox.NMXInventory;
if (!inv) throw new Error('No se pudo cargar NMXInventory desde ' + invPath);

const esc = (s) => String(s).replace(/'/g, "''");

const rows = inv.products.map((p) => {
  const fileName = p.sku + '.xlsx';
  const filePath = './secure-files/excel/' + fileName;
  const version = p.version === 'NO_CONFIRMADO' ? 'PENDIENTE_DE_VALIDACION' : p.version;
  return `('${p.id}', '${esc(p.sku)}', '${esc(p.name)}', '${esc(p.category)}', ${p.price}, '${esc(version)}',\n  '${esc(fileName)}', '${esc(filePath)}', true)`;
});

const sql = [
  '-- GENERADO AUTOMATICAMENTE por db/generate-seed.js — NO EDITAR A MANO.',
  '-- Fuente: nutrimetria-inventory.js (' + inv.products.length + ' productos reales NUTRIMETRIA).',
  '-- La ruta fisica NO se guarda: se deriva del SKU en services/assetResolver.js.',
  '-- Las versiones declaradas como NO_CONFIRMADO en los archivos se guardan como PENDIENTE_DE_VALIDACION.',
  '',
  'INSERT INTO products (id, sku, name, category, price_clp, version, file_name, active) VALUES',
  rows.join(',\n'),
  'ON CONFLICT (id) DO UPDATE SET',
  '  sku = EXCLUDED.sku,',
  '  name = EXCLUDED.name,',
  '  category = EXCLUDED.category,',
  '  price_clp = EXCLUDED.price_clp,',
  '  version = EXCLUDED.version,',
  '  file_name = EXCLUDED.file_name,',
  '  active = EXCLUDED.active;',
  ''
].join('\n');

fs.writeFileSync(path.join(__dirname, 'seed.sql'), sql, 'utf8');
console.log('seed.sql generado con ' + inv.products.length + ' productos.');
