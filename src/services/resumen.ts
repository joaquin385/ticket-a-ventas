/**
 * Formatea resúmenes en español rioplatense para responder por WhatsApp
 */

import type { VentaExtracted } from '../extraction/schema.js';

export function formatearMontoARS(monto: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(monto);
}

export function formatearFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Resumen corto post-extracción exitosa
 */
export function resumenVentaRegistrada(venta: VentaExtracted): string {
  const monto = formatearMontoARS(venta.total);
  const fecha = formatearFecha(venta.fecha);
  const n = venta.items.length;
  const itemsLabel = n === 1 ? '1 ítem' : `${n} ítems`;
  return `✅ Registré tu venta: ${monto} en ${itemsLabel} (${fecha}).`;
}

/**
 * Mensaje cuando la confianza es baja
 */
export function resumenPendienteRevision(): string {
  return '📸 Recibí tu foto, la revisamos y te confirmamos.';
}
