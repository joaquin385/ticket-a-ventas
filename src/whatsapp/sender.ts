/**
 * Envío de mensajes de texto vía WhatsApp Cloud API
 */

export type SendMessageResult = {
  ok: boolean;
  messageId?: string;
  mocked?: boolean;
};

export interface IWhatsAppSender {
  enviarMensaje(telefono: string, texto: string): Promise<SendMessageResult>;
}

export type SenderOptions = {
  accessToken: string | null;
  phoneNumberId: string | null;
  apiVersion?: string;
  fetchFn?: typeof fetch;
};

/**
 * Mock: loguea y guarda mensajes enviados
 */
export class MockWhatsAppSender implements IWhatsAppSender {
  public sent: Array<{ telefono: string; texto: string }> = [];

  async enviarMensaje(
    telefono: string,
    texto: string
  ): Promise<SendMessageResult> {
    this.sent.push({ telefono, texto });
    console.log(`[whatsapp:mock] → ${telefono}: ${texto}`);
    return { ok: true, mocked: true, messageId: `mock_${this.sent.length}` };
  }
}

/**
 * Cliente real Graph API messages
 */
export class GraphWhatsAppSender implements IWhatsAppSender {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string;
  private fetchFn: typeof fetch;

  constructor(options: SenderOptions) {
    if (!options.accessToken || !options.phoneNumberId) {
      throw new Error(
        'WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID requeridos'
      );
    }
    this.accessToken = options.accessToken;
    this.phoneNumberId = options.phoneNumberId;
    this.apiVersion = options.apiVersion ?? 'v21.0';
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async enviarMensaje(
    telefono: string,
    texto: string
  ): Promise<SendMessageResult> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: telefono,
        type: 'text',
        text: { body: texto },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error enviando WhatsApp (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as {
      messages?: Array<{ id: string }>;
    };

    return {
      ok: true,
      messageId: json.messages?.[0]?.id,
    };
  }
}

export function createWhatsAppSender(options: SenderOptions): IWhatsAppSender {
  if (options.accessToken && options.phoneNumberId) {
    return new GraphWhatsAppSender(options);
  }
  console.warn('[whatsapp] Sin credenciales de envío: usando MockWhatsAppSender');
  return new MockWhatsAppSender();
}
