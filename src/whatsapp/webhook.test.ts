/**
 * Tests para el webhook de WhatsApp
 */

import { describe, it, expect, vi } from 'vitest';
import {
  verificarWebhook,
  procesarMensaje,
  extraerMensajesImagen,
  type WebhookVerifyParams,
  type WebhookMessagePayload,
} from './webhook.js';
import { MockMediaClient } from './media.js';

const payloadImagen: WebhookMessagePayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            messages: [
              {
                from: '5491112345678',
                id: 'wamid.123',
                timestamp: '1699564800',
                type: 'image',
                image: {
                  id: 'media_12345',
                  mime_type: 'image/jpeg',
                  sha256: 'abc123',
                },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

describe('Webhook de WhatsApp', () => {
  describe('verificarWebhook', () => {
    const VERIFY_TOKEN = 'mi_token_secreto_123';

    it('debería retornar el challenge cuando el token es correcto', () => {
      const params: WebhookVerifyParams = {
        mode: 'subscribe',
        token: VERIFY_TOKEN,
        challenge: 'challenge_12345',
      };

      const resultado = verificarWebhook(params, VERIFY_TOKEN);
      expect(resultado).toBe('challenge_12345');
    });

    it('debería retornar null cuando el token es incorrecto', () => {
      const params: WebhookVerifyParams = {
        mode: 'subscribe',
        token: 'token_incorrecto',
        challenge: 'challenge_12345',
      };

      const resultado = verificarWebhook(params, VERIFY_TOKEN);
      expect(resultado).toBeNull();
    });

    it('debería retornar null cuando el modo no es subscribe', () => {
      const params: WebhookVerifyParams = {
        mode: 'unsubscribe',
        token: VERIFY_TOKEN,
        challenge: 'challenge_12345',
      };

      const resultado = verificarWebhook(params, VERIFY_TOKEN);
      expect(resultado).toBeNull();
    });
  });

  describe('extraerMensajesImagen', () => {
    it('debería listar media ids de imágenes', () => {
      const imgs = extraerMensajesImagen(payloadImagen);
      expect(imgs).toHaveLength(1);
      expect(imgs[0].mediaId).toBe('media_12345');
      expect(imgs[0].from).toBe('5491112345678');
    });
  });

  describe('procesarMensaje', () => {
    it('debería procesar imagen y descargar media vía mock', async () => {
      const onImage = vi.fn();
      const resultado = await procesarMensaje(payloadImagen, {
        mediaClient: new MockMediaClient(),
        onImage,
      });

      expect(resultado).toBe(true);
      expect(onImage).toHaveBeenCalledTimes(1);
      const arg = onImage.mock.calls[0][0];
      expect(arg.mediaId).toBe('media_12345');
      expect(arg.buffer).toBeInstanceOf(Buffer);
      expect(arg.mediaUrl).toContain('media_12345');
    });

    it('debería procesar correctamente un mensaje de texto', async () => {
      const onText = vi.fn();
      const payload: WebhookMessagePayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  messages: [
                    {
                      from: '5491112345678',
                      id: 'wamid.456',
                      timestamp: '1699564800',
                      type: 'text',
                      text: {
                        body: 'Hola',
                      },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const resultado = await procesarMensaje(payload, { onText });
      expect(resultado).toBe(true);
      expect(onText).toHaveBeenCalledWith('5491112345678', 'Hola');
    });

    it('debería retornar false cuando el objeto no es whatsapp_business_account', async () => {
      const payload: WebhookMessagePayload = {
        object: 'page',
        entry: [],
      };

      const resultado = await procesarMensaje(payload);
      expect(resultado).toBe(false);
    });

    it('debería manejar payload sin mensajes', async () => {
      const payload: WebhookMessagePayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const resultado = await procesarMensaje(payload);
      expect(resultado).toBe(true);
    });
  });
});
