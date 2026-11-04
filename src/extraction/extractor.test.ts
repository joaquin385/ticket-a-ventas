/**
 * Tests para los extractores de datos
 */

import { describe, it, expect, vi } from 'vitest';
import {
  MockExtractor,
  VisionLLMExtractor,
  createExtractor,
  bufferToDataUrl,
} from './extractor.js';
import { VentaExtractedSchema, requiereRevision } from './schema.js';
import { loadConfig } from '../config.js';
import altaConfianza from './fixtures/venta-alta-confianza.json' with { type: 'json' };
import bajaConfianza from './fixtures/venta-baja-confianza.json' with { type: 'json' };

describe('Extractores', () => {
  describe('fixtures', () => {
    it('debería validar fixture de alta confianza', () => {
      const venta = VentaExtractedSchema.parse(altaConfianza);
      expect(venta.confianza).toBeGreaterThanOrEqual(0.7);
      expect(requiereRevision(venta)).toBe(false);
    });

    it('debería marcar fixture de baja confianza para revisión', () => {
      const venta = VentaExtractedSchema.parse(bajaConfianza);
      expect(venta.confianza).toBeLessThan(0.7);
      expect(requiereRevision(venta)).toBe(true);
    });
  });

  describe('MockExtractor', () => {
    it('debería retornar datos válidos según el schema', async () => {
      const extractor = new MockExtractor('alta');
      const resultado = await extractor.extract('https://example.com/foto.jpg');

      const validacion = VentaExtractedSchema.safeParse(resultado);
      expect(validacion.success).toBe(true);
      expect(resultado.items.length).toBeGreaterThan(0);
      expect(resultado.confianza).toBeGreaterThanOrEqual(0);
      expect(resultado.confianza).toBeLessThanOrEqual(1);
    });

    it('debería retornar baja confianza con fixture baja', async () => {
      const extractor = new MockExtractor('baja');
      const flags = await extractor.extractWithFlags!('baja');
      expect(flags.bajaConfianza).toBe(true);
      expect(flags.venta.confianza).toBeLessThan(0.7);
    });

    it('debería retornar total consistente con subtotales', async () => {
      const extractor = new MockExtractor('alta');
      const resultado = await extractor.extract('https://example.com/foto.jpg');
      const suma = resultado.items.reduce((a, i) => a + i.subtotal, 0);
      expect(resultado.total).toBeCloseTo(suma, 2);
    });
  });

  describe('VisionLLMExtractor', () => {
    it('debería parsear y validar respuesta JSON del LLM', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(altaConfianza),
              },
            },
          ],
        }),
      });

      const extractor = new VisionLLMExtractor({
        apiKey: 'sk-test',
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      const venta = await extractor.extract('data:image/jpeg;base64,abc');
      expect(venta.total).toBe(3850);
      expect(fetchFn).toHaveBeenCalledTimes(1);

      const [, init] = fetchFn.mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.response_format.type).toBe('json_schema');
      expect(body.messages[0].role).toBe('system');
    });

    it('debería rechazar JSON inválido del LLM', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"fecha":"mala","items":[],"total":0,"medio_pago":null,"confianza":2}' } }],
        }),
      });

      const extractor = new VisionLLMExtractor({
        apiKey: 'sk-test',
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      await expect(
        extractor.extract('data:image/jpeg;base64,abc')
      ).rejects.toThrow();
    });

    it('debería fallar si la API responde error', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      });

      const extractor = new VisionLLMExtractor({
        apiKey: 'sk-bad',
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      await expect(
        extractor.extract('data:image/jpeg;base64,abc')
      ).rejects.toThrow(/401/);
    });
  });

  describe('createExtractor', () => {
    it('debería usar mock sin API key', () => {
      const config = loadConfig({ ...process.env, VISION_API_KEY: '' });
      const extractor = createExtractor(config);
      expect(extractor).toBeInstanceOf(MockExtractor);
    });

    it('debería usar VisionLLM con API key', () => {
      const config = loadConfig({
        ...process.env,
        VISION_API_KEY: 'sk-real',
        VISION_API_PROVIDER: 'openai',
      });
      const extractor = createExtractor(config);
      expect(extractor).toBeInstanceOf(VisionLLMExtractor);
    });
  });

  describe('bufferToDataUrl', () => {
    it('debería generar data URL', () => {
      const url = bufferToDataUrl(Buffer.from('abc'), 'image/png');
      expect(url).toBe('data:image/png;base64,YWJj');
    });
  });
});
