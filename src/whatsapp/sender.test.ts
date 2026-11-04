import { describe, it, expect, vi } from 'vitest';
import {
  MockWhatsAppSender,
  GraphWhatsAppSender,
  createWhatsAppSender,
} from './sender.js';

describe('WhatsApp sender', () => {
  it('Mock debería registrar mensajes', async () => {
    const sender = new MockWhatsAppSender();
    const r = await sender.enviarMensaje('54911', 'hola');
    expect(r.ok).toBe(true);
    expect(r.mocked).toBe(true);
    expect(sender.sent[0].texto).toBe('hola');
  });

  it('Graph debería POSTear a messages', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.x' }] }),
    });

    const sender = new GraphWhatsAppSender({
      accessToken: 'tok',
      phoneNumberId: '123',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const r = await sender.enviarMensaje('54911', 'chau');
    expect(r.messageId).toBe('wamid.x');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('createWhatsAppSender debería mockear sin credenciales', () => {
    const sender = createWhatsAppSender({
      accessToken: null,
      phoneNumberId: null,
    });
    expect(sender).toBeInstanceOf(MockWhatsAppSender);
  });
});
