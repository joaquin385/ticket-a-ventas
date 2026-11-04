import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../db/memoryStore.js';
import { createRepositories } from '../db/repositories/index.js';
import { loadConfig } from '../config.js';
import { MockWhatsAppSender } from '../whatsapp/sender.js';
import { InsightsHandler } from './insightsHandler.js';
import { VentaExtractedSchema } from '../extraction/schema.js';

describe('InsightsHandler', () => {
  let store: MemoryStore;
  let sender: MockWhatsAppSender;
  let handler: InsightsHandler;

  beforeEach(async () => {
    store = new MemoryStore();
    sender = new MockWhatsAppSender();
    const repos = createRepositories(
      loadConfig({ ...process.env, DATABASE_URL: '' }),
      store
    );
    handler = new InsightsHandler({ repos, sender });

    const { comercio } = await repos.comercios.encontrarOCrearPorTelefono(
      '5491100112233',
      'Kiosco Norte'
    );

    const fechas = ['2024-11-04', '2024-11-06', '2024-11-08', '2024-10-28'];
    for (const fecha of fechas) {
      await repos.ventas.crear({
        foto_id: null,
        comercio_id: comercio.id,
        extracted: VentaExtractedSchema.parse({
          fecha,
          items: [
            {
              descripcion: 'Producto X',
              cantidad: 1,
              precio_unitario: 1000,
              subtotal: 1000,
            },
          ],
          total: 1000,
          medio_pago: 'efectivo',
          confianza: 0.9,
        }),
        requiere_revision: false,
      });
    }
  });

  it('manejarResumen debería enviar mensaje con métricas', async () => {
    await handler.manejarResumen(
      '5491100112233',
      new Date('2024-11-10T12:00:00Z')
    );
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].texto).toContain('Resumen semanal');
    expect(sender.sent[0].texto).toContain('Kiosco Norte');
  });

  it('manejarPronostico debería enviar proyección', async () => {
    await handler.manejarPronostico(
      '5491100112233',
      new Date('2024-11-10T12:00:00Z')
    );
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].texto).toMatch(/Pronóstico|Pronostico/);
    expect(sender.sent[0].texto).toContain('Proyección');
  });

  it('enviarResumenSemanalATodos debería notificar activos', async () => {
    const result = await handler.enviarResumenSemanalATodos(
      new Date('2024-11-11T12:00:00Z') // lunes
    );
    expect(result.enviados).toBe(1);
    expect(result.errores).toBe(0);
    expect(sender.sent).toHaveLength(1);
  });
});
