-- Paquetes como productos reales, con su propio precio.
-- Antes los packs agregaban al carrito los NMX individuales a precio completo,
-- así que el total ignoraba el precio del pack (ej. $75.890 en vez de $27.990).
-- Ahora cada pack ES un producto: se cobra su precio, y bundle_items dice qué
-- archivos entrega para que las descargas sigan funcionando igual.
ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_items TEXT[];

INSERT INTO products (id, sku, name, category, price_clp, version, file_name, active, bundle_items) VALUES
('pack-estudiante', 'PACK-ESTUDIANTE', 'Pack Estudiante', 'Paquete de herramientas', 27990, 'v1.0', 'PACK-ESTUDIANTE.xlsx', true,
  ARRAY['nmx01','nmx13','nmxp1','nmx21','nmx14m','nmx12','nmx36']),
('pack-antropometria', 'PACK-ANTROPOMETRIA', 'Pack Antropometría', 'Paquete de herramientas', 17990, 'v1.0', 'PACK-ANTROPOMETRIA.xlsx', true,
  ARRAY['nmx20','nmx06','nmx41','nmx10']),
('pack-consulta', 'PACK-CONSULTA', 'Pack Consulta Nutricional', 'Paquete de herramientas', 24990, 'v1.0', 'PACK-CONSULTA.xlsx', true,
  ARRAY['nmx03','nmx13','nmx20','nmx21','nmx07']),
('pack-profesional', 'PACK-PROFESIONAL', 'Pack Profesional', 'Paquete de herramientas', 23990, 'v1.0', 'PACK-PROFESIONAL.xlsx', true,
  ARRAY['nmx01','nmx21','nmx12','nmx11','nmx43'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_clp = EXCLUDED.price_clp,
  bundle_items = EXCLUDED.bundle_items,
  active = EXCLUDED.active;
