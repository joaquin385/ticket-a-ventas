/**
 * Factory de repositorios: Postgres si hay DATABASE_URL, memoria si no
 */

import type { AppConfig } from '../../config.js';
import { sharedMemoryStore, type MemoryStore } from '../memoryStore.js';
import {
  MemoryComercioRepository,
  PostgresComercioRepository,
  type IComercioRepository,
} from './comercioRepository.js';
import {
  MemoryFotoRepository,
  PostgresFotoRepository,
  type IFotoRepository,
} from './fotoRepository.js';
import {
  MemoryVentaRepository,
  PostgresVentaRepository,
  type IVentaRepository,
} from './ventaRepository.js';
import {
  MemorySuscripcionRepository,
  PostgresSuscripcionRepository,
  type ISuscripcionRepository,
} from './suscripcionRepository.js';

export type Repositories = {
  comercios: IComercioRepository;
  fotos: IFotoRepository;
  ventas: IVentaRepository;
  suscripciones: ISuscripcionRepository;
  mode: 'memory' | 'postgres';
  store?: MemoryStore;
};

export function createRepositories(
  config: AppConfig,
  store: MemoryStore = sharedMemoryStore
): Repositories {
  if (!config.databaseUrl) {
    console.warn('[db] Sin DATABASE_URL: usando repositorios in-memory');
    return {
      comercios: new MemoryComercioRepository(store),
      fotos: new MemoryFotoRepository(store),
      ventas: new MemoryVentaRepository(store),
      suscripciones: new MemorySuscripcionRepository(store),
      mode: 'memory',
      store,
    };
  }

  return {
    comercios: new PostgresComercioRepository(),
    fotos: new PostgresFotoRepository(),
    ventas: new PostgresVentaRepository(),
    suscripciones: new PostgresSuscripcionRepository(),
    mode: 'postgres',
  };
}

export type {
  IComercioRepository,
  IFotoRepository,
  IVentaRepository,
  ISuscripcionRepository,
};
