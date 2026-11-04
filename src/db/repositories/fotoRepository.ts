/**
 * Repositorio de fotos
 */

import type { Foto } from '../types.js';
import type { MemoryStore } from '../memoryStore.js';
import { query } from '../client.js';

export type CrearFotoInput = {
  comercio_id: string;
  usuario_id?: string | null;
  whatsapp_media_id: string;
  url_foto?: string | null;
  estado?: Foto['estado'];
  metadata?: Record<string, unknown> | null;
};

export interface IFotoRepository {
  guardar(input: CrearFotoInput): Promise<Foto>;
  actualizarEstado(
    fotoId: string,
    estado: Foto['estado'],
    urlFoto?: string | null
  ): Promise<Foto>;
  obtenerPorId(id: string): Promise<Foto | null>;
}

export class MemoryFotoRepository implements IFotoRepository {
  constructor(private store: MemoryStore) {}

  async guardar(input: CrearFotoInput): Promise<Foto> {
    const foto: Foto = {
      id: this.store.nuevoId(),
      comercio_id: input.comercio_id,
      usuario_id: input.usuario_id ?? null,
      whatsapp_media_id: input.whatsapp_media_id,
      url_foto: input.url_foto ?? null,
      fecha_subida: new Date(),
      estado: input.estado ?? 'pendiente',
      metadata: input.metadata ?? null,
    };
    this.store.fotos.set(foto.id, foto);
    return foto;
  }

  async actualizarEstado(
    fotoId: string,
    estado: Foto['estado'],
    urlFoto?: string | null
  ): Promise<Foto> {
    const foto = this.store.fotos.get(fotoId);
    if (!foto) {
      throw new Error(`Foto ${fotoId} no encontrada`);
    }
    foto.estado = estado;
    if (urlFoto !== undefined) {
      foto.url_foto = urlFoto;
    }
    return foto;
  }

  async obtenerPorId(id: string): Promise<Foto | null> {
    return this.store.fotos.get(id) ?? null;
  }
}

export class PostgresFotoRepository implements IFotoRepository {
  async guardar(input: CrearFotoInput): Promise<Foto> {
    const result = await query<Foto>(
      `INSERT INTO fotos (comercio_id, usuario_id, whatsapp_media_id, url_foto, estado, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.comercio_id,
        input.usuario_id ?? null,
        input.whatsapp_media_id,
        input.url_foto ?? null,
        input.estado ?? 'pendiente',
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );
    return mapFoto(result.rows[0]);
  }

  async actualizarEstado(
    fotoId: string,
    estado: Foto['estado'],
    urlFoto?: string | null
  ): Promise<Foto> {
    const result = await query<Foto>(
      `UPDATE fotos
       SET estado = $2,
           url_foto = COALESCE($3, url_foto)
       WHERE id = $1
       RETURNING *`,
      [fotoId, estado, urlFoto ?? null]
    );
    if (!result.rows[0]) {
      throw new Error(`Foto ${fotoId} no encontrada`);
    }
    return mapFoto(result.rows[0]);
  }

  async obtenerPorId(id: string): Promise<Foto | null> {
    const result = await query<Foto>(`SELECT * FROM fotos WHERE id = $1`, [id]);
    return result.rows[0] ? mapFoto(result.rows[0]) : null;
  }
}

function mapFoto(row: Foto): Foto {
  return {
    ...row,
    fecha_subida: new Date(row.fecha_subida),
    metadata:
      typeof row.metadata === 'string'
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : row.metadata,
  };
}
