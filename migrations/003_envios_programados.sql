-- Migración 003: registro de envíos programados (resumen semanal / forecast)
--
-- Idempotente. NO aplicar automáticamente a Neon desde el agente:
-- revisar y correr a mano cuando quieras auditar jobs.
--
-- Uso conceptual:
--   INSERT al completar POST /api/jobs/resumen-semanal
--   (el wiring de persistencia puede agregarse en un milestone posterior)

CREATE TABLE IF NOT EXISTS envios_programados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID REFERENCES comercios(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL, -- resumen_semanal | forecast_mensual
  canal VARCHAR(30) NOT NULL DEFAULT 'whatsapp',
  periodo_desde DATE,
  periodo_hasta DATE,
  payload JSONB, -- métricas enviadas / mensaje truncado
  estado VARCHAR(30) NOT NULL DEFAULT 'enviado', -- enviado | error
  error_mensaje TEXT,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_envios_programados_comercio_tipo
  ON envios_programados(comercio_id, tipo, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_envios_programados_tipo_fecha
  ON envios_programados(tipo, creado_en DESC);

COMMENT ON TABLE envios_programados IS
  'Auditoría de jobs programados (resumen semanal, forecast). Opcional para ops.';
