-- Migración de la Fase 4 — perfil de cliente editable.
-- La página Perfil mostraba datos de ejemplo fijos en inputs sin onChange:
-- React los revertía en cada tecla porque eran "controlados" sin handler.
-- Estas columnas y los endpoints en auth.js son el dato real detrás de esa página.
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS product_updates_opt_in BOOLEAN NOT NULL DEFAULT true;
