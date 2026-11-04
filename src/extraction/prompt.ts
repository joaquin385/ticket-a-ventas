/**
 * Prompt de extracción para Vision LLM
 */

export const EXTRACTION_SYSTEM_PROMPT = `Sos un asistente que extrae datos estructurados de fotos de tickets de venta en Argentina.

La imagen puede ser un ticket impreso, un cuaderno manuscrito o una lista de productos y precios.

Respondé ÚNICAMENTE con un objeto JSON válido (sin markdown) con este schema:
{
  "fecha": "YYYY-MM-DD",
  "hora": "HH:MM",
  "items": [
    {
      "descripcion": "string",
      "cantidad": number,
      "precio_unitario": number,
      "subtotal": number
    }
  ],
  "total": number,
  "medio_pago": "efectivo" | "debito" | "credito" | "transferencia" | null,
  "confianza": number
}

Reglas:
- Si no hay fecha visible, usá la fecha de hoy en Argentina.
- Si no podés leer algo, bajá la confianza (< 0.5).
- Si falta precio unitario, calculalo desde subtotal/cantidad.
- Si falta total, sumá los subtotales.
- Montos en pesos argentinos (ARS).
- confianza entre 0.0 y 1.0.`;

export const EXTRACTION_JSON_SCHEMA = {
  name: 'venta_extraida',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['fecha', 'items', 'total', 'medio_pago', 'confianza'],
    properties: {
      fecha: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      hora: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['descripcion', 'cantidad', 'subtotal'],
          properties: {
            descripcion: { type: 'string' },
            cantidad: { type: 'number' },
            precio_unitario: { type: 'number' },
            subtotal: { type: 'number' },
          },
        },
      },
      total: { type: 'number' },
      medio_pago: {
        anyOf: [
          {
            type: 'string',
            enum: ['efectivo', 'debito', 'credito', 'transferencia'],
          },
          { type: 'null' },
        ],
      },
      confianza: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
} as const;
