/**
 * Tests de validación para la migración 002_create_tables.sql
 *
 * Valida estructura del SQL (tablas, FKs, índices, idempotencia).
 * No usa pg-mem: no soporta DECIMAL(p,s) ni varios features de Postgres 18.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(__dirname, '002_create_tables.sql');

const TABLAS_ESPERADAS = [
  'comercios',
  'usuarios',
  'fotos',
  'ventas',
  'items',
  'suscripciones',
] as const;

const INDICES_ESPERADOS = [
  'idx_ventas_comercio_fecha',
  'idx_fotos_comercio_estado',
  'idx_items_venta',
  'idx_suscripciones_comercio',
] as const;

describe('Migración 002_create_tables.sql', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');

  // Remover comentarios de línea para análisis de statements
  const sqlSinComentarios = sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

  it('debería existir y no estar vacío', () => {
    expect(sql.length).toBeGreaterThan(500);
  });

  it.each(TABLAS_ESPERADAS)(
    'debería crear la tabla %s de forma idempotente',
    (tabla) => {
      expect(sqlSinComentarios).toMatch(
        new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${tabla}\\b`, 'i')
      );
    }
  );

  it.each(INDICES_ESPERADOS)(
    'debería crear el índice %s de forma idempotente',
    (indice) => {
      expect(sqlSinComentarios).toMatch(
        new RegExp(
          `CREATE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${indice}\\b`,
          'i'
        )
      );
    }
  );

  it('debería definir foreign keys con ON DELETE CASCADE y SET NULL', () => {
    expect(sqlSinComentarios).toMatch(/FOREIGN\s+KEY\s*\(\s*comercio_id\s*\)/i);
    expect(sqlSinComentarios).toMatch(/FOREIGN\s+KEY\s*\(\s*venta_id\s*\)/i);
    expect(sqlSinComentarios).toMatch(/FOREIGN\s+KEY\s*\(\s*foto_id\s*\)/i);
    expect(sqlSinComentarios).toMatch(/FOREIGN\s+KEY\s*\(\s*usuario_id\s*\)/i);
    expect(sqlSinComentarios).toMatch(/ON\s+DELETE\s+CASCADE/i);
    expect(sqlSinComentarios).toMatch(/ON\s+DELETE\s+SET\s+NULL/i);
  });

  it('debería usar gen_random_uuid() para primary keys', () => {
    expect(sqlSinComentarios).toMatch(/DEFAULT\s+gen_random_uuid\(\)/i);
  });

  it('debería incluir timestamps de auditoría', () => {
    expect(sqlSinComentarios).toMatch(/creado_en\s+TIMESTAMP\s+DEFAULT\s+NOW\(\)/i);
    expect(sqlSinComentarios).toMatch(/creada_en\s+TIMESTAMP\s+DEFAULT\s+NOW\(\)/i);
    expect(sqlSinComentarios).toMatch(/actualizada_en\s+TIMESTAMP\s+DEFAULT\s+NOW\(\)/i);
    expect(sqlSinComentarios).toMatch(/fecha_subida\s+TIMESTAMP\s+DEFAULT\s+NOW\(\)/i);
  });

  it('debería incluir columnas clave del modelo de ventas', () => {
    expect(sqlSinComentarios).toMatch(/confianza_score\s+DECIMAL/i);
    expect(sqlSinComentarios).toMatch(/requiere_revision\s+BOOLEAN/i);
    expect(sqlSinComentarios).toMatch(/medio_pago\s+VARCHAR/i);
    expect(sqlSinComentarios).toMatch(/datos_raw\s+JSONB/i);
  });

  it('debería incluir columnas clave de suscripciones', () => {
    expect(sqlSinComentarios).toMatch(/mercadopago_preapproval_id/i);
    expect(sqlSinComentarios).toMatch(/fotos_usadas_mes/i);
    expect(sqlSinComentarios).toMatch(/limite_fotos_mes/i);
    expect(sqlSinComentarios).toMatch(/fecha_fin_trial/i);
  });

  it('debería incluir CHECK constraints', () => {
    expect(sqlSinComentarios).toMatch(/chk_ventas_total_positivo/i);
    expect(sqlSinComentarios).toMatch(/chk_ventas_confianza_rango/i);
    expect(sqlSinComentarios).toMatch(/chk_items_cantidad_positiva/i);
  });

  it('debería parsear en statements SQL válidos (terminados en ;)', () => {
    const statements = sqlSinComentarios
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Al menos: 6 CREATE TABLE + 8 CREATE INDEX + varios COMMENT ON
    expect(statements.length).toBeGreaterThanOrEqual(14);

    for (const stmt of statements) {
      const startsWithKeyword =
        /^(CREATE|COMMENT|ALTER)\b/i.test(stmt);
      expect(startsWithKeyword).toBe(true);
    }
  });

  it('debería definir las 6 tablas en el orden correcto (FKs)', () => {
    const posiciones = TABLAS_ESPERADAS.map((tabla) => {
      const match = sqlSinComentarios.match(
        new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${tabla}\\b`, 'i')
      );
      expect(match).not.toBeNull();
      return sqlSinComentarios.indexOf(match![0]);
    });

    // comercios < usuarios < fotos < ventas < items
    // suscripciones después de comercios
    expect(posiciones[0]).toBeLessThan(posiciones[1]); // comercios antes usuarios
    expect(posiciones[1]).toBeLessThan(posiciones[2]); // usuarios antes fotos
    expect(posiciones[2]).toBeLessThan(posiciones[3]); // fotos antes ventas
    expect(posiciones[3]).toBeLessThan(posiciones[4]); // ventas antes items
    expect(posiciones[0]).toBeLessThan(posiciones[5]); // comercios antes suscripciones
  });
});
