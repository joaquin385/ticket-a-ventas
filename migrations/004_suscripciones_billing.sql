-- Migración 004: campos extra de billing Mercado Pago (M6)
--
-- Extiende la tabla suscripciones creada en 002.
-- Idempotente. NO aplicar automáticamente a Neon desde el agente.

-- Link de checkout (init_point de preapproval)
ALTER TABLE suscripciones
  ADD COLUMN IF NOT EXISTS init_point TEXT;

-- Contador de fotos durante el trial (14 días o N fotos)
ALTER TABLE suscripciones
  ADD COLUMN IF NOT EXISTS fotos_usadas_trial INT DEFAULT 0;

ALTER TABLE suscripciones
  ADD COLUMN IF NOT EXISTS limite_fotos_trial INT DEFAULT 30;

COMMENT ON COLUMN suscripciones.estado IS
  'trial | activa | pausada | cancelada | en_mora';

COMMENT ON COLUMN suscripciones.init_point IS
  'URL de pago Mercado Pago (preapproval init_point)';

COMMENT ON COLUMN suscripciones.fotos_usadas_trial IS
  'Fotos consumidas en el período de prueba';

COMMENT ON COLUMN suscripciones.limite_fotos_trial IS
  'Tope de fotos en trial (default 30)';

CREATE INDEX IF NOT EXISTS idx_suscripciones_preapproval
  ON suscripciones(mercadopago_preapproval_id)
  WHERE mercadopago_preapproval_id IS NOT NULL;
