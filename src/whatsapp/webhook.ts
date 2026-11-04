/**
 * Webhook de WhatsApp Cloud API
 *
 * Maneja verificación (GET), recepción (POST), descarga de media e imágenes
 */

import type { IMediaClient } from './media.js';
import { MockMediaClient } from './media.js';

export interface WebhookVerifyParams {
  mode: string;
  token: string;
  challenge: string;
}

export type WhatsAppImageMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: 'image';
  image: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
};

export type WhatsAppTextMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: 'text';
  text: {
    body: string;
  };
};

export type WhatsAppMessage = WhatsAppImageMessage | WhatsAppTextMessage | {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
  text?: {
    body: string;
  };
};

export interface WebhookMessagePayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata?: {
          phone_number_id?: string;
          display_phone_number?: string;
        };
        messages?: WhatsAppMessage[];
      };
      field: string;
    }>;
  }>;
}

export type ImagenRecibida = {
  from: string;
  messageId: string;
  mediaId: string;
  mimeType: string;
  buffer: Buffer;
  mediaUrl: string;
};

export type ProcesarMensajeOptions = {
  mediaClient?: IMediaClient;
  onImage?: (imagen: ImagenRecibida) => Promise<void> | void;
  onText?: (from: string, body: string) => Promise<void> | void;
};

/**
 * Verifica el webhook durante la configuración en Meta Developer Console
 */
export function verificarWebhook(
  params: WebhookVerifyParams,
  verifyToken: string
): string | null {
  const { mode, token, challenge } = params;

  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }

  return null;
}

/**
 * Extrae mensajes de imagen del payload
 */
export function extraerMensajesImagen(
  payload: WebhookMessagePayload
): Array<{ from: string; messageId: string; mediaId: string; mimeType: string }> {
  const result: Array<{
    from: string;
    messageId: string;
    mediaId: string;
    mimeType: string;
  }> = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      for (const message of change.value.messages ?? []) {
        if (message.type === 'image' && message.image) {
          result.push({
            from: message.from,
            messageId: message.id,
            mediaId: message.image.id,
            mimeType: message.image.mime_type,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Procesa mensajes entrantes de WhatsApp
 *
 * Descarga media de imágenes vía mediaClient (Graph API o mock)
 */
export async function procesarMensaje(
  payload: WebhookMessagePayload,
  options: ProcesarMensajeOptions = {}
): Promise<boolean> {
  if (payload.object !== 'whatsapp_business_account') {
    console.log('Webhook recibido no es de WhatsApp Business');
    return false;
  }

  const mediaClient = options.mediaClient ?? new MockMediaClient();

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const { messages } = change.value;

      if (!messages || messages.length === 0) {
        continue;
      }

      for (const message of messages) {
        console.log('Mensaje recibido:', {
          from: message.from,
          type: message.type,
          timestamp: message.timestamp,
        });

        if (message.type === 'image' && message.image) {
          console.log('Foto detectada:', message.image.id);
          const downloaded = await mediaClient.download(message.image.id);
          const imagen: ImagenRecibida = {
            from: message.from,
            messageId: message.id,
            mediaId: message.image.id,
            mimeType: downloaded.mimeType || message.image.mime_type,
            buffer: downloaded.buffer,
            mediaUrl: downloaded.url,
          };

          if (options.onImage) {
            await options.onImage(imagen);
          }
        }

        if (message.type === 'text' && message.text) {
          console.log('Mensaje de texto:', message.text.body);
          if (options.onText) {
            await options.onText(message.from, message.text.body);
          }
        }
      }
    }
  }

  return true;
}
