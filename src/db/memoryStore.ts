/**
 * Store in-memory para tests y desarrollo sin DATABASE_URL
 */

import { randomUUID } from 'node:crypto';
import type {
  Comercio,
  Usuario,
  Foto,
  Venta,
  Item,
  Suscripcion,
} from './types.js';

export class MemoryStore {
  comercios = new Map<string, Comercio>();
  usuarios = new Map<string, Usuario>();
  fotos = new Map<string, Foto>();
  ventas = new Map<string, Venta>();
  items = new Map<string, Item>();
  suscripciones = new Map<string, Suscripcion>();

  nuevoId(): string {
    return randomUUID();
  }

  clear(): void {
    this.comercios.clear();
    this.usuarios.clear();
    this.fotos.clear();
    this.ventas.clear();
    this.items.clear();
    this.suscripciones.clear();
  }
}

/** Singleton compartido para modo mock */
export const sharedMemoryStore = new MemoryStore();
