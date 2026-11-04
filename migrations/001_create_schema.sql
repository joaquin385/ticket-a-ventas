-- Migración 001: Crear schema base y extensiones
-- 
-- Crea las extensiones necesarias y el schema principal

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extensión para funciones de texto avanzadas (opcional, útil para búsquedas)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Comentario
COMMENT ON EXTENSION "uuid-ossp" IS 'Generación de UUIDs para primary keys';
