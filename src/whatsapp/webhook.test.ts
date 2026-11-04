/**
 * Tests para el webhook de WhatsApp
 */

import { describe, it, expect } from 'vitest';
import {
  verificarWebhook,
  procesarMensaje,
  type WebhookVerifyParams,
  type WebhookMessagePayload,
} from './webhook.js';

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

  describe('procesarMensaje', () => {
    it('debería procesar correctamente un mensaje con imagen', async () => {
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

      const resultado = await procesarMensaje(payload);
      expect(resultado).toBe(true);
    });

    it('debería procesar correctamente un mensaje de texto', async () => {
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

      const resultado = await procesarMensaje(payload);
      expect(resultado).toBe(true);
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
