/**
 * Repositorio de comercios y usuarios
 */

import type { Comercio, Usuario } from '../types.js';
import type { MemoryStore } from '../memoryStore.js';
import { query } from '../client.js';

export interface IComercioRepository {
  encontrarOCrearPorTelefono(
    telefono: string,
    nombre?: string
  ): Promise<{ comercio: Comercio; usuario: Usuario; creado: boolean }>;
  obtenerPorId(id: string): Promise<Comercio | null>;
}

export class MemoryComercioRepository implements IComercioRepository {
  constructor(private store: MemoryStore) {}

  async encontrarOCrearPorTelefono(
    telefono: string,
    nombre = 'Comercio nuevo'
  ): Promise<{ comercio: Comercio; usuario: Usuario; creado: boolean }> {
    for (const c of this.store.comercios.values()) {
      if (c.telefono_whatsapp === telefono) {
        const usuario = [...this.store.usuarios.values()].find(
          (u) => u.comercio_id === c.id
        );
        if (!usuario) {
          throw new Error('Comercio sin usuario');
        }
        return { comercio: c, usuario, creado: false };
      }
    }

    const comercio: Comercio = {
      id: this.store.nuevoId(),
      nombre,
      telefono_whatsapp: telefono,
      email: null,
      direccion: null,
      tipo_comercio: null,
      creado_en: new Date(),
      activo: true,
    };
    this.store.comercios.set(comercio.id, comercio);

    const usuario: Usuario = {
      id: this.store.nuevoId(),
      comercio_id: comercio.id,
      nombre: 'Dueño',
      telefono,
      rol: 'dueño',
      creado_en: new Date(),
    };
    this.store.usuarios.set(usuario.id, usuario);

    return { comercio, usuario, creado: true };
  }

  async obtenerPorId(id: string): Promise<Comercio | null> {
    return this.store.comercios.get(id) ?? null;
  }
}

export class PostgresComercioRepository implements IComercioRepository {
  async encontrarOCrearPorTelefono(
    telefono: string,
    nombre = 'Comercio nuevo'
  ): Promise<{ comercio: Comercio; usuario: Usuario; creado: boolean }> {
    const existing = await query<Comercio>(
      `SELECT * FROM comercios WHERE telefono_whatsapp = $1 LIMIT 1`,
      [telefono]
    );

    if (existing.rows[0]) {
      const comercio = mapComercio(existing.rows[0]);
      const usuarios = await query<Usuario>(
        `SELECT * FROM usuarios WHERE comercio_id = $1 ORDER BY creado_en ASC LIMIT 1`,
        [comercio.id]
      );
      let usuario = usuarios.rows[0] ? mapUsuario(usuarios.rows[0]) : null;
      if (!usuario) {
        const inserted = await query<Usuario>(
          `INSERT INTO usuarios (comercio_id, nombre, telefono, rol)
           VALUES ($1, $2, $3, 'dueño') RETURNING *`,
          [comercio.id, 'Dueño', telefono]
        );
        usuario = mapUsuario(inserted.rows[0]);
      }
      return { comercio, usuario, creado: false };
    }

    const insertedComercio = await query<Comercio>(
      `INSERT INTO comercios (nombre, telefono_whatsapp)
       VALUES ($1, $2) RETURNING *`,
      [nombre, telefono]
    );
    const comercio = mapComercio(insertedComercio.rows[0]);

    const insertedUsuario = await query<Usuario>(
      `INSERT INTO usuarios (comercio_id, nombre, telefono, rol)
       VALUES ($1, $2, $3, 'dueño') RETURNING *`,
      [comercio.id, 'Dueño', telefono]
    );

    return {
      comercio,
      usuario: mapUsuario(insertedUsuario.rows[0]),
      creado: true,
    };
  }

  async obtenerPorId(id: string): Promise<Comercio | null> {
    const result = await query<Comercio>(
      `SELECT * FROM comercios WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? mapComercio(result.rows[0]) : null;
  }
}

function mapComercio(row: Comercio): Comercio {
  return {
    ...row,
    creado_en: new Date(row.creado_en),
  };
}

function mapUsuario(row: Usuario): Usuario {
  return {
    ...row,
    creado_en: new Date(row.creado_en),
  };
}
