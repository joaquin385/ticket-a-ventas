import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '004_suscripciones_billing.sql'),
  'utf-8'
);

describe('Migración 004_suscripciones_billing.sql', () => {
  it('debería agregar init_point y contadores de trial', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS init_point/i);
    expect(sql).toMatch(/fotos_usadas_trial/i);
    expect(sql).toMatch(/limite_fotos_trial/i);
  });

  it('debería documentar estados de billing', () => {
    expect(sql).toMatch(/en_mora/);
    expect(sql).toMatch(/pausada/);
  });
});
