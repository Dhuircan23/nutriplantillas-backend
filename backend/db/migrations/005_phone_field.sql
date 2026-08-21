-- Fase: registro con teléfono y política de contraseña más estricta.
-- El teléfono se recolecta al crear la cuenta (users.name/country ya existían
-- desde la migración 004; users.phone no).
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
