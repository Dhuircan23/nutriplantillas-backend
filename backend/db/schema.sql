-- NutriPlantillas — esquema PostgreSQL
-- Reemplaza la persistencia 100% localStorage del prototipo por estado real en servidor.

CREATE TABLE IF NOT EXISTS users (
  id                     SERIAL PRIMARY KEY,
  email                  TEXT UNIQUE NOT NULL,
  password_hash          TEXT, -- NULL para cuentas creadas solo por Google/Apple (sin contraseña propia)
  role                   TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  failed_login_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Identidades externas (Google / Apple) vinculadas a una cuenta. Un usuario
-- puede tener 0, 1, o varias (ej. inició con Google y también vinculó Apple).
-- La vinculación a una cuenta ya existente se hace por email verificado —
-- nunca se confía en un email que el proveedor no marque como verificado.
CREATE TABLE IF NOT EXISTS oauth_identities (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider           TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
  provider_user_id   TEXT NOT NULL,
  email              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_identities_user ON oauth_identities(user_id);

-- Sesiones reales, para que un JWT se pueda revocar de verdad (logout,
-- sospecha de robo) en vez de quedar válido igual hasta su expiración.
-- El JWT lleva el id de esta fila (claim "sid"); cada request autenticado
-- valida que la sesión siga existiendo y no esté revocada ni vencida.
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,          -- 'nmx01', 'nmx09', etc. (mismo id que store.js del frontend)
  sku               TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  category          TEXT,
  price_clp         INTEGER NOT NULL CHECK (price_clp >= 0),
  version           TEXT NOT NULL,
  file_name         TEXT NOT NULL,             -- etiqueta de descarga (Content-Disposition), no una ruta
  active            BOOLEAN NOT NULL DEFAULT true,

  -- Fase C: contenido de marketing, migrado desde el PRODUCTS estático que
  -- vivía en store.js del frontend. Los campos con forma variable (listas de
  -- viñetas, FAQ, tablas de compatibilidad) quedan en JSONB a propósito: no
  -- se filtran ni se consultan por su contenido interno en ningún lado de la
  -- app, así que normalizarlos en tablas separadas sería complejidad sin
  -- beneficio real a esta escala (5 productos).
  description       TEXT,
  badge             TEXT,
  updated_label     TEXT,
  format            TEXT,
  language          TEXT,
  status_label      TEXT,
  license_text      TEXT,
  support_text      TEXT,
  limitations       TEXT,
  tabs              JSONB,
  results           JSONB,
  equations         JSONB,
  sources           JSONB,
  instructions      JSONB,
  functions         JSONB,
  variables         JSONB,
  compat            JSONB,
  faq               JSONB,
  version_history   JSONB
);

CREATE TABLE IF NOT EXISTS cart_items (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  order_code       TEXT UNIQUE NOT NULL,     -- 'NP-2026-XXXXXX', visible al cliente
  user_id          INTEGER NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'authorized', 'paid', 'failed', 'cancelled')),
  total_clp        INTEGER NOT NULL CHECK (total_clp >= 0),
  webpay_token      TEXT,
  webpay_buy_order   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at            TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_items (
  id                 SERIAL PRIMARY KEY,
  order_id           INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id         TEXT NOT NULL REFERENCES products(id),
  product_name       TEXT NOT NULL,       -- snapshot: si el producto cambia de nombre despues, el pedido no muta
  price_clp          INTEGER NOT NULL,    -- snapshot del precio al momento de comprar
  downloads_allowed  INTEGER NOT NULL DEFAULT 5,
  downloads_used     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);

-- Agregado para el job de reconciliación (Fase A del roadmap full-stack):
-- registra la última vez que se revisó un pedido 'pending' contra Transbank,
-- para detectar y corregir pedidos que quedaron atascados por una caída del
-- servidor o de la base de datos justo durante la confirmación del pago.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reconciliation_checked_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_pending_reconcile
  ON orders(status, created_at) WHERE status = 'pending';

-- Agregado en la Fase B (si la base ya existía desde antes, CREATE TABLE
-- IF NOT EXISTS no habría sumado estas columnas nuevas por sí solo).
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Agregado al sumar login con Google/Apple: las cuentas creadas solo por
-- OAuth no tienen contraseña propia.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Agregado en la Fase C: contenido de marketing migrado desde store.js.
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_label TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS status_label TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS license_text TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS support_text TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS limitations TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tabs JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS results JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS equations JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sources JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS instructions JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS functions JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variables JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS compat JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS faq JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS version_history JSONB;
