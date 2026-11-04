/**
 * Tests de validación de firma de webhook
 */

import { describe, it, expect } from 'vitest';
import {
  calcularFirma,
  validarFirma,
  aceptarRequestFirmado,
} from './signature.js';

describe('Firma de webhook WhatsApp', () => {
  const secret = 'app_secret_de_prueba';
  const body = '{"object":"whatsapp_business_account"}';

  it('debería calcular firma sha256=...', () => {
    const firma = calcularFirma(body, secret);
    expect(firma).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('debería validar firma correcta', () => {
    const firma = calcularFirma(body, secret);
    expect(validarFirma(body, firma, secret)).toBe(true);
  });

  it('debería rechazar firma incorrecta', () => {
    expect(validarFirma(body, 'sha256=deadbeef', secret)).toBe(false);
  });

  it('debería rechazar header ausente', () => {
    expect(validarFirma(body, undefined, secret)).toBe(false);
  });

  it('debería aceptar sin secret en modo desarrollo', () => {
    const result = aceptarRequestFirmado(body, undefined, null);
    expect(result.ok).toBe(true);
    expect(result.motivo).toBe('sin_secret');
  });

  it('debería rechazar firma inválida cuando hay secret', () => {
    const result = aceptarRequestFirmado(body, 'sha256=abc', secret);
    expect(result.ok).toBe(false);
  });
});
