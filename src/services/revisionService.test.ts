import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../db/memoryStore.js';
import { createRepositories } from '../db/repositories/index.js';
import { loadConfig } from '../config.js';
import { MockWhatsAppSender } from '../whatsapp/sender.js';
import { RevisionService } from './revisionService.js';
import { VentaExtractedSchema } from '../extraction/schema.js';

describe('RevisionService', () => {
  let store: MemoryStore;
  let sender: MockWhatsAppSender;
  let service: RevisionService;
  let ventaId: string;

  beforeEach(async () => {
    store = new MemoryStore();
    sender = new MockWhatsAppSender();
    const repos = createRepositories(
      loadConfig({ ...process.env, DATABASE_URL: '' }),
      store
    );
    service = new RevisionService({ repos, sender });

    const { comercio, usuario } =
      await repos.comercios.encontrarOCrearPorTelefono(
        '5491144433322',
        'Kiosco Revisión'
      );
    const foto = await repos.fotos.guardar({
      comercio_id: comercio.id,
      usuario_id: usuario.id,
      whatsapp_media_id: 'm-rev',
      url_foto: 'https://mock/foto.jpg',
      estado: 'revision',
    });
    const venta = await repos.ventas.crear({
      foto_id: foto.id,
      comercio_id: comercio.id,
      extracted: VentaExtractedSchema.parse({
        fecha: '2024-11-04',
        items: [
          {
            descripcion: 'dudoso',
            cantidad: 1,
            precio_unitario: 100,
            subtotal: 100,
          },
        ],
        total: 100,
        medio_pago: null,
        confianza: 0.4,
      }),
      requiere_revision: true,
    });
    ventaId = venta.id;
  });

  it('debería listar pendientes de revisión', async () => {
    const list = await service.listarPendientes();
    expect(list).toHaveLength(1);
    expect(list[0].url_foto).toContain('foto.jpg');
    expect(list[0].nombre_comercio).toBe('Kiosco Revisión');
  });

  it('debería editar total e items', async () => {
    const updated = await service.editar(ventaId, {
      total: 250,
      items: [
        {
          descripcion: 'Coca',
          cantidad: 1,
          subtotal: 250,
          precio_unitario: 250,
        },
      ],
    });
    expect(updated.total).toBe(250);
    expect(updated.items[0].descripcion).toBe('Coca');
  });

  it('debería aprobar y notificar por WhatsApp', async () => {
    const approved = await service.aprobar(ventaId);
    expect(approved.revisada).toBe(true);
    expect(approved.requiere_revision).toBe(false);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].texto).toContain('confirmado');
    const pendientes = await service.listarPendientes();
    expect(pendientes).toHaveLength(0);
  });
});
