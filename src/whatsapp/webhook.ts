/**
 * Webhook de WhatsApp Cloud API
 * 
 * Maneja la verificación inicial (GET) y la recepción de mensajes (POST)
 */

export interface WebhookVerifyParams {
  mode: string;
  token: string;
  challenge: string;
}

export interface WebhookMessagePayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        messages?: Array<{
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
        }>;
      };
      field: string;
    }>;
  }>;
}

/**
 * Verifica el webhook durante la configuración en Meta Developer Console
 * 
 * @param params - Parámetros de query string enviados por WhatsApp
 * @param verifyToken - Token secreto configurado en las variables de entorno
 * @returns El challenge si la verificación es exitosa, null si falla
 */
export function verificarWebhook(
  params: WebhookVerifyParams,
  verifyToken: string
): string | null {
  const { mode, token, challenge } = params;

  // Verificar que sea modo subscribe y el token coincida
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }

  return null;
}

/**
 * Procesa mensajes entrantes de WhatsApp
 * 
 * @param payload - Payload del webhook de WhatsApp
 * @returns true si se procesó exitosamente
 */
export async function procesarMensaje(
  payload: WebhookMessagePayload
): Promise<boolean> {
  // Validar que sea un mensaje de WhatsApp
  if (payload.object !== 'whatsapp_business_account') {
    console.log('Webhook recibido no es de WhatsApp Business');
    return false;
  }

  // Extraer mensajes
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

        // Detectar si es una imagen
        if (message.type === 'image' && message.image) {
          console.log('Foto detectada:', message.image.id);
          // TODO: Procesar foto en Milestone 2
        }

        // Detectar si es texto
        if (message.type === 'text' && message.text) {
          console.log('Mensaje de texto:', message.text.body);
          // TODO: Procesar comando en Milestone 4
        }
      }
    }
  }

  return true;
}
