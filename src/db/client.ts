/**
 * Cliente de base de datos para Neon serverless Postgres
 * 
 * Usa @neondatabase/serverless para conexiones optimizadas en edge/serverless
 */

import { neonConfig, Pool } from '@neondatabase/serverless';

// Configuración para desarrollo local (WebSocket)
// En producción, Neon usa HTTP fetch automáticamente
if (process.env.NODE_ENV === 'development') {
  neonConfig.wsProxy = (host) => `${host}:5432/v1`;
}

let pool: Pool | null = null;

/**
 * Obtiene una instancia del pool de conexiones
 * Singleton pattern para reusar conexiones
 */
export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL no está configurada en las variables de entorno');
    }

    pool = new Pool({ connectionString: databaseUrl });
  }

  return pool;
}

/**
 * Ejecuta una query SQL con parámetros
 * 
 * @param text - Query SQL con placeholders $1, $2, etc.
 * @param params - Array de parámetros
 * @returns Resultado de la query
 */
export async function query<T = any>(text: string, params?: any[]) {
  const pool = getPool();
  return pool.query<T>(text, params);
}

/**
 * Cierra el pool de conexiones
 * Llamar solo al finalizar la aplicación
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
