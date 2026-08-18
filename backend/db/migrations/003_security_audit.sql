-- Migración de la Fase 3 (auditoría de seguridad).
-- Idempotente: se puede correr sobre una base ya existente.

-- 1. Estados de pedido nuevos. El CHECK original no incluía
--    'payment_processing' ni 'refunded', así que un intento de moverse a esos
--    estados habría fallado en runtime.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'payment_processing', 'authorized', 'paid', 'failed', 'cancelled', 'refunded'));

-- 2. Registro de auditoría de descargas. Es la evidencia de la cadena
--    compra -> permiso -> entrega, y la fuente para investigar abusos.
--    NO guarda tokens, cookies ni credenciales: solo qué se intentó y por qué
--    se permitió o se negó.
CREATE TABLE IF NOT EXISTS download_events (
  id             BIGSERIAL PRIMARY KEY,
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  order_item_id  INTEGER REFERENCES order_items(id) ON DELETE SET NULL,
  asset_type     TEXT,
  outcome        TEXT NOT NULL,
  reason         TEXT,
  ip             TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_download_events_user ON download_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_download_events_denied
  ON download_events(created_at DESC) WHERE outcome <> 'allowed';

-- 3. Integridad del cupo de descargas. El decremento ahora es atómico en el
--    UPDATE, pero además la base impide que el contador se salga de rango por
--    cualquier otra vía.
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_downloads_range;
ALTER TABLE order_items ADD CONSTRAINT order_items_downloads_range
  CHECK (downloads_used >= 0 AND downloads_used <= downloads_allowed);

-- 4. Un mismo producto no debe aparecer dos veces en el mismo pedido: si no,
--    se duplica el cupo de descargas por accidente.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_unique_product
  ON order_items(order_id, product_id);

-- 5. Proveedor de pago usado en cada intento, para trazabilidad cuando exista
--    más de uno (manual hoy, Transbank en la Fase 4).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT;

-- 6. products.file_path queda ELIMINADA.
--    Era el origen del BLOCKER de path traversal: downloads.js resolvía esa
--    ruta sin comprobar contención. Desde la Fase 3 la ruta se deriva del SKU
--    en services/assetResolver.js, con lista blanca y comprobación de
--    contención, así que esta columna no tenía lectores y sí era una
--    superficie de ataque si alguien la volvía a usar.
ALTER TABLE products DROP COLUMN IF EXISTS file_path;
