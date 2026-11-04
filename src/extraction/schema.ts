/**
 * Schemas de validación para datos extraídos de tickets/fotos
 * 
 * Usa Zod para validación en runtime y type-safety en compile time
 */

import { z } from 'zod';

/**
 * Schema para un item individual de una venta
 */
export const ItemVentaSchema = z.object({
  descripcion: z
    .string()
    .min(1, 'La descripción no puede estar vacía')
    .max(500, 'La descripción es demasiado larga'),
  cantidad: z
    .number()
    .positive('La cantidad debe ser positiva')
    .default(1.0),
  precio_unitario: z
    .number()
    .nonnegative('El precio unitario no puede ser negativo')
    .optional(),
  subtotal: z
    .number()
    .nonnegative('El subtotal no puede ser negativo'),
});

export type ItemVenta = z.infer<typeof ItemVentaSchema>;

/**
 * Schema para los datos extraídos de una venta completa
 */
export const VentaExtractedSchema = z.object({
  fecha: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'La fecha debe estar en formato YYYY-MM-DD'
    ),
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'La hora debe estar en formato HH:MM')
    .optional(),
  items: z
    .array(ItemVentaSchema)
    .min(1, 'Debe haber al menos un item'),
  total: z
    .number()
    .nonnegative('El total no puede ser negativo'),
  medio_pago: z
    .enum(['efectivo', 'debito', 'credito', 'transferencia'])
    .nullable(),
  confianza: z
    .number()
    .min(0, 'La confianza debe estar entre 0 y 1')
    .max(1, 'La confianza debe estar entre 0 y 1'),
});

export type VentaExtracted = z.infer<typeof VentaExtractedSchema>;

/**
 * Umbral de confianza para considerar una extracción como confiable
 */
export const UMBRAL_CONFIANZA_ALTA = 0.7;

/**
 * Valida que el total de la venta coincida con la suma de subtotales
 * 
 * @param venta - Datos extraídos de la venta
 * @param tolerancia - Tolerancia en pesos para diferencias de redondeo
 * @returns true si el total es consistente
 */
export function validarConsistenciaTotal(
  venta: VentaExtracted,
  tolerancia = 1.0
): boolean {
  const sumaSubtotales = venta.items.reduce(
    (acc, item) => acc + item.subtotal,
    0
  );
  const diferencia = Math.abs(venta.total - sumaSubtotales);
  return diferencia <= tolerancia;
}

/**
 * Determina si una venta requiere revisión manual
 * 
 * @param venta - Datos extraídos de la venta
 * @returns true si requiere revisión
 */
export function requiereRevision(venta: VentaExtracted): boolean {
  // Confianza baja
  if (venta.confianza < UMBRAL_CONFIANZA_ALTA) {
    return true;
  }

  // Total inconsistente con items
  if (!validarConsistenciaTotal(venta)) {
    return true;
  }

  // Total sospechosamente alto (> ARS 1 millón)
  if (venta.total > 1_000_000) {
    return true;
  }

  return false;
}
