-- Migración 002: Crear tablas del modelo de datos
--
-- Crea todas las tablas del sistema con sus relaciones, índices y constraints
-- Idempotente: puede ejecutarse múltiples veces sin errores

-- Tabla: comercios
-- Representa los comercios que usan la plataforma
CREATE TABLE IF NOT EXISTS comercios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  telefono_whatsapp VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  direccion TEXT,
  tipo_comercio VARCHAR(50), -- kiosco, almacen, verduleria, etc.
  creado_en TIMESTAMP DEFAULT NOW(),
  activo BOOLEAN DEFAULT true
);

COMMENT ON TABLE comercios IS 'Comercios registrados en la plataforma';
COMMENT ON COLUMN comercios.telefono_whatsapp IS 'Número de WhatsApp con código de país (ej: 5491112345678)';

-- Tabla: usuarios
-- Usuarios asociados a cada comercio (dueño, empleados)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL,
  nombre VARCHAR(255),
  telefono VARCHAR(20),
  rol VARCHAR(50) DEFAULT 'dueño', -- dueño, empleado
  creado_en TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_usuarios_comercio 
    FOREIGN KEY (comercio_id) 
    REFERENCES comercios(id) 
    ON DELETE CASCADE
);

COMMENT ON TABLE usuarios IS 'Usuarios que operan cada comercio';

-- Tabla: fotos
-- Fotos de tickets recibidas por WhatsApp
CREATE TABLE IF NOT EXISTS fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL,
  usuario_id UUID,
  whatsapp_media_id VARCHAR(255) NOT NULL,
  url_foto TEXT,
  fecha_subida TIMESTAMP DEFAULT NOW(),
  estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, procesada, error, revision
  metadata JSONB, -- datos del mensaje de WhatsApp
  CONSTRAINT fk_fotos_comercio 
    FOREIGN KEY (comercio_id) 
    REFERENCES comercios(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_fotos_usuario 
    FOREIGN KEY (usuario_id) 
    REFERENCES usuarios(id) 
    ON DELETE SET NULL
);

COMMENT ON TABLE fotos IS 'Fotos de tickets/cuadernos recibidas por WhatsApp';
COMMENT ON COLUMN fotos.estado IS 'pendiente: sin procesar | procesada: extracción exitosa | error: falló | revision: requiere revisión manual';

-- Tabla: ventas
-- Ventas extraídas de las fotos
CREATE TABLE IF NOT EXISTS ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foto_id UUID,
  comercio_id UUID NOT NULL,
  fecha_venta DATE NOT NULL,
  hora_venta TIME,
  total DECIMAL(12, 2) NOT NULL,
  medio_pago VARCHAR(50), -- efectivo, debito, credito, transferencia
  confianza_score DECIMAL(3, 2), -- 0.00 a 1.00
  requiere_revision BOOLEAN DEFAULT false,
  revisada BOOLEAN DEFAULT false,
  datos_raw JSONB, -- respuesta completa del LLM
  creada_en TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_ventas_foto 
    FOREIGN KEY (foto_id) 
    REFERENCES fotos(id) 
    ON DELETE SET NULL,
  CONSTRAINT fk_ventas_comercio 
    FOREIGN KEY (comercio_id) 
    REFERENCES comercios(id) 
    ON DELETE CASCADE,
  CONSTRAINT chk_ventas_total_positivo 
    CHECK (total >= 0),
  CONSTRAINT chk_ventas_confianza_rango 
    CHECK (confianza_score IS NULL OR (confianza_score >= 0 AND confianza_score <= 1))
);

COMMENT ON TABLE ventas IS 'Ventas extraídas de las fotos con datos estructurados';
COMMENT ON COLUMN ventas.confianza_score IS 'Score de confianza del LLM (0.0 a 1.0). NULL si no se pudo calcular';

-- Tabla: items
-- Items individuales de cada venta
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL,
  descripcion VARCHAR(500) NOT NULL,
  cantidad DECIMAL(10, 3) DEFAULT 1.0,
  precio_unitario DECIMAL(10, 2),
  subtotal DECIMAL(12, 2) NOT NULL,
  orden INT DEFAULT 0, -- orden en el ticket
  CONSTRAINT fk_items_venta 
    FOREIGN KEY (venta_id) 
    REFERENCES ventas(id) 
    ON DELETE CASCADE,
  CONSTRAINT chk_items_cantidad_positiva 
    CHECK (cantidad > 0),
  CONSTRAINT chk_items_subtotal_no_negativo 
    CHECK (subtotal >= 0)
);

COMMENT ON TABLE items IS 'Items individuales de cada venta';
COMMENT ON COLUMN items.orden IS 'Orden de aparición en el ticket original';

-- Tabla: suscripciones
-- Suscripciones y billing de cada comercio
CREATE TABLE IF NOT EXISTS suscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL,
  plan VARCHAR(50) NOT NULL, -- basico, plus
  precio_mensual DECIMAL(10, 2) NOT NULL,
  estado VARCHAR(50) DEFAULT 'trial', -- trial, activa, vencida, cancelada
  mercadopago_preapproval_id VARCHAR(255),
  fecha_inicio DATE NOT NULL,
  fecha_fin_trial DATE,
  fecha_proximo_cobro DATE,
  fotos_usadas_mes INT DEFAULT 0,
  limite_fotos_mes INT,
  creada_en TIMESTAMP DEFAULT NOW(),
  actualizada_en TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_suscripciones_comercio 
    FOREIGN KEY (comercio_id) 
    REFERENCES comercios(id) 
    ON DELETE CASCADE,
  CONSTRAINT chk_suscripciones_precio_positivo 
    CHECK (precio_mensual >= 0),
  CONSTRAINT chk_suscripciones_fotos_no_negativo 
    CHECK (fotos_usadas_mes >= 0)
);

COMMENT ON TABLE suscripciones IS 'Suscripciones y billing de cada comercio';
COMMENT ON COLUMN suscripciones.estado IS 'trial: período de prueba | activa: pagando | vencida: pago rechazado | cancelada: dada de baja';

-- Índices para optimizar queries frecuentes

-- Índice para queries de ventas por comercio y fecha (dashboard, resúmenes)
CREATE INDEX IF NOT EXISTS idx_ventas_comercio_fecha 
  ON ventas(comercio_id, fecha_venta DESC);

-- Índice para filtrar fotos por comercio y estado (cola de procesamiento)
CREATE INDEX IF NOT EXISTS idx_fotos_comercio_estado 
  ON fotos(comercio_id, estado);

-- Índice para obtener items de una venta (detalle de venta)
CREATE INDEX IF NOT EXISTS idx_items_venta 
  ON items(venta_id);

-- Índice para obtener suscripción activa de un comercio
CREATE INDEX IF NOT EXISTS idx_suscripciones_comercio 
  ON suscripciones(comercio_id);

-- Índice para queries de ventas que requieren revisión
CREATE INDEX IF NOT EXISTS idx_ventas_revision 
  ON ventas(comercio_id, requiere_revision) 
  WHERE requiere_revision = true;

-- Índice para búsqueda de comercios por teléfono (lookup en webhook)
CREATE INDEX IF NOT EXISTS idx_comercios_telefono 
  ON comercios(telefono_whatsapp);

-- Índice para suscripciones por estado (billing automation)
CREATE INDEX IF NOT EXISTS idx_suscripciones_estado 
  ON suscripciones(estado);

-- Índice para fotos pendientes de procesar
CREATE INDEX IF NOT EXISTS idx_fotos_pendientes 
  ON fotos(fecha_subida) 
  WHERE estado = 'pendiente';
