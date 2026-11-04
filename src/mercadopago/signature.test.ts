import { describe, it, expect } from 'vitest';
import {
  parseXSignature,
  construirManifest,
  calcularFirmaMp,
  validarFirmaMercadoPago,
  aceptarWebhookMp,
} from './signature.js';

describe('Firma Mercado Pago', () => {
  const secret = 'mp_webhook_secret';
  const dataId = 'preapproval_123';
  const requestId = 'req-abc';

  it('debería parsear x-signature', () => {
    const p = parseXSignature('ts=1700000000,v1=abcdef');
    expect(p).toEqual({ ts: '1700000000', v1: 'abcdef' });
  });

  it('debería validar firma correcta', () => {
    const ts = '1700000000';
    const manifest = construirManifest(dataId, requestId, ts);
    const v1 = calcularFirmaMp(manifest, secret);
    expect(
      validarFirmaMercadoPago({
        xSignature: `ts=${ts},v1=${v1}`,
        xRequestId: requestId,
        dataId,
        secret,
      })
    ).toBe(true);
  });

  it('debería rechazar firma incorrecta', () => {
    expect(
      validarFirmaMercadoPago({
        xSignature: 'ts=1,v1=deadbeef',
        xRequestId: requestId,
        dataId,
        secret,
      })
    ).toBe(false);
  });

  it('debería aceptar sin secret en modo mock', () => {
    const r = aceptarWebhookMp({
      xSignature: undefined,
      xRequestId: undefined,
      dataId,
      secret: null,
    });
    expect(r.ok).toBe(true);
  });
});
