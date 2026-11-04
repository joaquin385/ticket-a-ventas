/**
 * Validación de firma X-Hub-Signature-256 de webhooks de Meta/WhatsApp
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Calcula la firma HMAC-SHA256 del body en crudo
 */
export function calcularFirma(rawBody: string | Buffer, appSecret: string): string {
  const hmac = createHmac('sha256', appSecret);
  hmac.update(rawBody);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Valida el header X-Hub-Signature-256 contra el body en crudo
 *
 * @returns true si la firma es válida
 */
export function validarFirma(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expected = calcularFirma(rawBody, appSecret);

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signatureHeader, 'utf8');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Decide si aceptar el request según configuración
 *
 * - Con WHATSAPP_APP_SECRET: exige firma válida
 * - Sin secret (dev/mock): acepta y loguea warning
 */
export function aceptarRequestFirmado(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  appSecret: string | null
): { ok: boolean; motivo?: string } {
  if (!appSecret) {
    console.warn(
      '[whatsapp] WHATSAPP_APP_SECRET no configurado: se omite validación de firma (solo desarrollo)'
    );
    return { ok: true, motivo: 'sin_secret' };
  }

  if (!validarFirma(rawBody, signatureHeader, appSecret)) {
    return { ok: false, motivo: 'firma_invalida' };
  }

  return { ok: true };
}
