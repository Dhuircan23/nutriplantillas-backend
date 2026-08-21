-- Recuperación de contraseña por correo (estilo Flow), reutiliza el mismo
-- SMTP ya configurado para la verificación de correo.
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;
