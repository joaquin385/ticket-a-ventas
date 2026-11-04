/**
 * Tests para los extractores de datos
 */

import { describe, it, expect } from 'vitest';
import { MockExtractor } from './extractor.js';
import { VentaExtractedSchema } from './schema.js';

describe('Extractores', () => {
  describe('MockExtractor', () => {
    it('debería retornar datos válidos según el schema', async () => {
      const extractor = new MockExtractor();
      const resultado = await extractor.extract('https://example.com/foto.jpg');

      // Validar con Zod
      const validacion = VentaExtractedSchema.safeParse(resultado);
      expect(validacion.success).toBe(true);

      if (validacion.success) {
        expect(validacion.data.items.length).toBeGreaterThan(0);
        expect(validacion.data.confianza).toBeGreaterThanOrEqual(0);
        expect(validacion.data.confianza).toBeLessThanOrEqual(1);
        expect(validacion.data.total).toBeGreaterThan(0);
      }
    });

    it('debería retornar una fecha en formato correcto', async () => {
      const extractor = new MockExtractor();
      const resultado = await extractor.extract('https://example.com/foto.jpg');

      expect(resultado.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('debería retornar items con descripción no vacía', async () => {
      const extractor = new MockExtractor();
      const resultado = await extractor.extract('https://example.com/foto.jpg');

      resultado.items.forEach((item) => {
        expect(item.descripcion).toBeTruthy();
        expect(item.descripcion.length).toBeGreaterThan(0);
      });
    });

    it('debería retornar un total consistente con los subtotales', async () => {
      const extractor = new MockExtractor();
      const resultado = await extractor.extract('https://example.com/foto.jpg');

      const sumaSubtotales = resultado.items.reduce(
        (acc, item) => acc + item.subtotal,
        0
      );

      expect(resultado.total).toBeCloseTo(sumaSubtotales, 2);
    });

    it('debería simular latencia (tomar al menos 50ms)', async () => {
      const extractor = new MockExtractor();
      const inicio = Date.now();
      await extractor.extract('https://example.com/foto.jpg');
      const duracion = Date.now() - inicio;

      expect(duracion).toBeGreaterThanOrEqual(50);
    });
  });
});
