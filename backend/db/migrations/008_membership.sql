-- Membresía mensual con descuento (Fase: sin Transbank, activación manual).
-- membership_status: 'none' | 'pending' | 'active' | 'expired'.
-- 'pending' = el usuario solicitó la membresía y espera confirmación de pago
-- de un admin (mismo patrón que confirm-manual de pedidos).
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_discount_percent INT NOT NULL DEFAULT 15;
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_requested_at TIMESTAMPTZ;
