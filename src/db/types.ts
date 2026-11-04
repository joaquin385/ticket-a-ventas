/**
 * Tipos de dominio persistidos
 */

export type Comercio = {
  id: string;
  nombre: string;
  telefono_whatsapp: string;
  email: string | null;
  direccion: string | null;
  tipo_comercio: string | null;
  creado_en: Date;
  activo: boolean;
};

export type Usuario = {
  id: string;
  comercio_id: string;
  nombre: string | null;
  telefono: string | null;
  rol: string;
  creado_en: Date;
};

export type Foto = {
  id: string;
  comercio_id: string;
  usuario_id: string | null;
  whatsapp_media_id: string;
  url_foto: string | null;
  fecha_subida: Date;
  estado: 'pendiente' | 'procesada' | 'error' | 'revision';
  metadata: Record<string, unknown> | null;
};

export type Venta = {
  id: string;
  foto_id: string | null;
  comercio_id: string;
  fecha_venta: string;
  hora_venta: string | null;
  total: number;
  medio_pago: string | null;
  confianza_score: number | null;
  requiere_revision: boolean;
  revisada: boolean;
  datos_raw: Record<string, unknown> | null;
  creada_en: Date;
};

export type Item = {
  id: string;
  venta_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number | null;
  subtotal: number;
  orden: number;
};
