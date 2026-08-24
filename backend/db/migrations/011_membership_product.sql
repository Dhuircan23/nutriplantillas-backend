-- Membresía como PRODUCTO, para que se pague por la misma pasarela que todo lo
-- demás (Mercado Pago) en vez de quedar esperando confirmación manual.
-- bundle_items queda NULL: no entrega archivos, activa el descuento.
-- is_membership marca el producto para que markOrderPaid active los 30 días.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_membership BOOLEAN NOT NULL DEFAULT false;

INSERT INTO products (id, sku, name, category, price_clp, version, file_name, active, is_membership) VALUES
('membership-mensual', 'MEMBRESIA', 'Membresía Nutrimetría — 1 mes', 'Membresía', 2990, 'v1.0', 'MEMBRESIA.txt', true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_clp = EXCLUDED.price_clp,
  is_membership = EXCLUDED.is_membership,
  active = EXCLUDED.active;
