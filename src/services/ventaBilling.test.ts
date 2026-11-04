/**
 * Gate de billing en el pipeline de fotos
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../db/memoryStore.js';
import { createRepositories } from '../db/repositories/index.js';
import { loadConfig } from '../config.js';
import { MockExtractor } from '../extraction/extractor.js';
import { MockStorage } from '../storage/storage.js';
import { MockWhatsAppSender } from '../whatsapp/sender.js';
import { MockMercadoPagoClient } from '../mercadopago/client.js';
import { SuscripcionService } from './suscripcionService.js';
import { VentaService } from './ventaService.js';
import type { ImagenRecibida } from '../whatsapp/webhook.js';

describe('VentaService + billing gate', () => {
  let store: MemoryStore;
  let sender: MockWhatsAppSender;
  let service: VentaService;
  let suscripciones: SuscripcionService;

  const imagen: ImagenRecibida = {
    from: '5491155512345',
    messageId: 'wamid.b',
    mediaId: 'media_b',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('img'),
    mediaUrl: 'https://mock/m',
  };

  beforeEach(() => {
    store = new MemoryStore();
    sender = new MockWhatsAppSender();
    const repos = createRepositories(
      loadConfig({ ...process.env, DATABASE_URL: '' }),
      store
    );
    suscripciones = new SuscripcionService(
      repos,
      new MockMercadoPagoClient(),
      {
        precioMensualArs: 7000,
        trialDias: 14,
        trialFotos: 2, // trial corto para test
        baseUrl: 'http://localhost:3000',
      }
    );
    service = new VentaService({
      repos,
      storage: new MockStorage(),
      extractor: new MockExtractor('alta'),
      sender,
      suscripciones,
    });
  });

  it('debería permitir fotos en trial', async () => {
    const r = await service.procesarImagen(imagen);
    expect(r.bloqueado).toBeFalsy();
    expect(r.venta).not.toBeNull();
  });

  it('debería bloquear cuando se acaba el trial por fotos', async () => {
    await service.procesarImagen(imagen);
    await service.procesarImagen({ ...imagen, mediaId: 'm2' });
    const r = await service.procesarImagen({ ...imagen, mediaId: 'm3' });
    expect(r.bloqueado).toBe(true);
    expect(r.venta).toBeNull();
    expect(sender.sent.at(-1)?.texto).toMatch(/prueba gratis|suscrib/i);
    expect(sender.sent.at(-1)?.texto).toContain('http');
  });
});
