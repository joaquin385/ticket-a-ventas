import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../db/memoryStore.js';
import { createRepositories } from '../db/repositories/index.js';
import { loadConfig } from '../config.js';
import { MockWhatsAppSender } from '../whatsapp/sender.js';
import { MockDocumentSender } from '../whatsapp/documentSender.js';
import { ExportHandler } from './exportHandler.js';
import { VentaExtractedSchema } from '../extraction/schema.js';
import alta from '../extraction/fixtures/venta-alta-confianza.json' with { type: 'json' };

describe('ExportHandler', () => {
  let store: MemoryStore;
  let sender: MockWhatsAppSender;
  let docs: MockDocumentSender;
  let handler: ExportHandler;
  let comercioId: string;

  beforeEach(async () => {
    store = new MemoryStore();
    sender = new MockWhatsAppSender();
    docs = new MockDocumentSender();
    const config = loadConfig({ ...process.env, DATABASE_URL: '' });
    const repos = createRepositories(config, store);
    handler = new ExportHandler({ repos, sender, documentSender: docs });

    const { comercio } = await repos.comercios.encontrarOCrearPorTelefono(
      '5491100001111'
    );
    comercioId = comercio.id;
    const hoy = new Date().toISOString().slice(0, 10);
    await repos.ventas.crear({
      foto_id: null,
      comercio_id: comercioId,
      extracted: VentaExtractedSchema.parse({ ...alta, fecha: hoy }),
      requiere_revision: false,
    });
  });

  it('debería exportar por comercio vía API helper', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const result = await handler.exportarPorComercio(
      comercioId,
      hoy,
      hoy,
      'xlsx',
      'mes'
    );
    expect(result.archivo.filas).toBe(3);
    expect(result.archivo.filename).toContain('mes');
  });

  it('debería manejar "exportar mes" por WhatsApp y enviar documento', async () => {
    const handled = await handler.manejarTextoWhatsApp(
      '5491100001111',
      'exportar mes'
    );
    expect(handled).toBe(true);
    expect(docs.sent).toHaveLength(1);
    expect(docs.sent[0].filename).toMatch(/\.xlsx$/);
    expect(docs.sent[0].buffer.length).toBeGreaterThan(0);
    expect(sender.sent.some((m) => m.texto.includes('Listo'))).toBe(true);
  });

  it('debería enviar CSV cuando el comando pide csv y hay ventas en rango', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const result = await handler.exportarPorComercio(
      comercioId,
      hoy,
      hoy,
      'csv',
      'hoy'
    );
    expect(result.archivo.formato).toBe('csv');
    expect(result.archivo.buffer.toString('utf8')).toContain('Producto');
  });

  it('debería ignorar texto que no es exportar', async () => {
    const handled = await handler.manejarTextoWhatsApp('5491100001111', 'hola');
    expect(handled).toBe(false);
    expect(docs.sent).toHaveLength(0);
  });
});
