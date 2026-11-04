import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../db/memoryStore.js';
import { createRepositories } from '../db/repositories/index.js';
import { loadConfig } from '../config.js';
import { MockWhatsAppSender } from '../whatsapp/sender.js';
import { MockMercadoPagoClient } from '../mercadopago/client.js';
import { SuscripcionService } from './suscripcionService.js';
import { BillingHandler } from './billingHandler.js';

describe('BillingHandler', () => {
  let sender: MockWhatsAppSender;
  let handler: BillingHandler;

  beforeEach(() => {
    const store = new MemoryStore();
    sender = new MockWhatsAppSender();
    const repos = createRepositories(
      loadConfig({ ...process.env, DATABASE_URL: '' }),
      store
    );
    const suscripciones = new SuscripcionService(
      repos,
      new MockMercadoPagoClient(),
      {
        precioMensualArs: 7000,
        trialDias: 14,
        trialFotos: 30,
        baseUrl: 'http://localhost:3000',
      }
    );
    handler = new BillingHandler({
      repos,
      sender,
      suscripciones,
      precioMensualArs: 7000,
    });
  });

  it('suscribirme debería enviar link de pago', async () => {
    await handler.manejarSuscribirme('5491199988877');
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].texto).toContain('Mercado Pago');
    expect(sender.sent[0].texto).toContain('http');
  });

  it('estado debería describir el plan', async () => {
    await handler.manejarEstado('5491199988877');
    expect(sender.sent[0].texto).toMatch(/plan|Prueba/i);
  });
});
