/**
 * Validación de firma x-signature de webhooks Mercado Pago
 *
 * Manifest: id:[data.id];request-id:[x-request-id];ts:[ts];
 * Header: x-signature = ts=...,v1=...
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export type MpSignatureParts = {
  ts: string;
  v1: string;
};

export function parseXSignature(
  header: string | undefined
): MpSignatureParts | null {
  if (!header) return null;
  const parts: Record<string, string> = {};
  for (const chunk of header.split(',')) {
    const [k, v] = chunk.trim().split('=');
    if (k && v) parts[k] = v;
  }
  if (!parts.ts || !parts.v1) return null;
  return { ts: parts.ts, v1: parts.v1 };
}

export function construirManifest(
  dataId: string,
  requestId: string,
  ts: string
): string {
  return `id:${dataId};request-id:${requestId};ts:${ts};`;
}

export function calcularFirmaMp(manifest: string, secret: string): string {
  return createHmac('sha256', secret).update(manifest).digest('hex');
}

/**
 * Valida x-signature según docs de Mercado Pago
 */
export function validarFirmaMercadoPago(params: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string;
  secret: string;
}): boolean {
  const parsed = parseXSignature(params.xSignature);
  if (!parsed || !params.xRequestId) return false;

  const manifest = construirManifest(
    params.dataId,
    params.xRequestId,
    parsed.ts
  );
  const expected = calcularFirmaMp(manifest, params.secret);

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(parsed.v1, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * En desarrollo sin secret: acepta (con warning)
 */
export function aceptarWebhookMp(params: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string;
  secret: string | null;
}): { ok: boolean; motivo?: string } {
  if (!params.secret) {
    console.warn(
      '[mercadopago] Sin MERCADOPAGO_WEBHOOK_SECRET: se omite validación de firma'
    );
    return { ok: true, motivo: 'sin_secret' };
  }
  if (
    !validarFirmaMercadoPago({
      ...params,
      secret: params.secret,
    })
  ) {
    return { ok: false, motivo: 'firma_invalida' };
  }
  return { ok: true };
}
