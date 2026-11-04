/**
 * Tests del pipeline M3 (memoria + mocks)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../db/memoryStore.js';
import { createRepositories } from '../db/repositories/index.js';
import { MockExtractor } from '../extraction/extractor.js';
import { MockStorage } from '../storage/storage.js';
import { MockWhatsAppSender } from '../whatsapp/sender.js';
import { VentaService } from './ventaService.js';
import { loadConfig } from '../config.js';
import type { ImagenRecibida } from '../whatsapp/webhook.js';

describe('VentaService', () => {
  let store: MemoryStore;
  let storage: MockStorage;
  let sender: MockWhatsAppSender;
  let service: VentaService;

  beforeEach(() => {
    store = new MemoryStore();
    storage = new MockStorage();
    sender = new MockWhatsAppSender();
    const config = loadConfig({ ...process.env, DATABASE_URL: '' });
    const repos = createRepositories(config, store);
    service = new VentaService({
      repos,
      storage,
      extractor: new MockExtractor('alta'),
      sender,
    });
  });

  const imagen: ImagenRecibida = {
    from: '5491199998888',
    messageId: 'wamid.1',
    mediaId: 'media_1',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fake-image'),
    mediaUrl: 'https://mock/media_1',
  };

  it('debería persistir comercio, foto, venta e items y responder', async () => {
    const result = await service.procesarImagen(imagen);

    expect(result.bajaConfianza).toBe(false);
    expect(result.venta.total).toBe(3850);
    expect(result.venta.items.length).toBe(3);
    expect(result.mensaje).toContain('✅');

    expect(store.comercios.size).toBe(1);
    expect(store.fotos.size).toBe(1);
    expect(store.ventas.size).toBe(1);
    expect(store.items.size).toBe(3);
    expect(storage.uploads.length).toBe(1);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].telefono).toBe('5491199998888');
  });

  it('debería marcar revisión y enviar mensaje de espera si confianza baja', async () => {
    const config = loadConfig({ ...process.env, DATABASE_URL: '' });
    const repos = createRepositories(config, store);
    service = new VentaService({
      repos,
      storage,
      extractor: new MockExtractor('baja'),
      sender,
    });

    const result = await service.procesarImagen(imagen);
    expect(result.bajaConfianza).toBe(true);
    expect(result.venta.requiere_revision).toBe(true);
    expect(result.mensaje).toContain('revisamos');

    const foto = [...store.fotos.values()][0];
    expect(foto.estado).toBe('revision');
  });

  it('debería reutilizar comercio existente por teléfono', async () => {
    await service.procesarImagen(imagen);
    await service.procesarImagen({ ...imagen, mediaId: 'media_2' });
    expect(store.comercios.size).toBe(1);
    expect(store.ventas.size).toBe(2);
  });
});
