/**
 * Validación estructural de migración 003 (no aplica a Neon)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(__dirname, '003_envios_programados.sql'),
  'utf-8'
);

describe('Migración 003_envios_programados.sql', () => {
  it('debería crear tabla envios_programados de forma idempotente', () => {
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS envios_programados/i
    );
  });

  it('debería referenciar comercios y tipar resumen/forecast', () => {
    expect(sql).toMatch(/REFERENCES comercios\(id\)/i);
    expect(sql).toMatch(/resumen_semanal/i);
    expect(sql).toMatch(/forecast_mensual/i);
  });

  it('debería definir índices', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_envios_programados_comercio_tipo/i
    );
  });
});
