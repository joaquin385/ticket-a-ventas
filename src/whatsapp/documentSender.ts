/**
 * Envío de documentos (CSV/Excel) por WhatsApp Cloud API
 *
 * Flujo Graph: upload media → send document message
 */

export type DocumentoEnviado = {
  ok: boolean;
  mediaId?: string;
  messageId?: string;
  mocked?: boolean;
};

export type DocumentoInput = {
  telefono: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  caption?: string;
};

export interface IDocumentSender {
  enviarDocumento(input: DocumentoInput): Promise<DocumentoEnviado>;
}

export type DocumentSenderOptions = {
  accessToken: string | null;
  phoneNumberId: string | null;
  apiVersion?: string;
  fetchFn?: typeof fetch;
};

/**
 * Mock: guarda documentos "enviados" para asserts en tests
 */
export class MockDocumentSender implements IDocumentSender {
  public sent: DocumentoInput[] = [];

  async enviarDocumento(input: DocumentoInput): Promise<DocumentoEnviado> {
    this.sent.push(input);
    console.log(
      `[whatsapp:mock] documento → ${input.telefono}: ${input.filename} (${input.buffer.length} bytes)`
    );
    return {
      ok: true,
      mocked: true,
      mediaId: `mock_media_${this.sent.length}`,
      messageId: `mock_doc_${this.sent.length}`,
    };
  }
}

/**
 * Cliente real: POST /{phone-number-id}/media + mensaje type=document
 */
export class GraphDocumentSender implements IDocumentSender {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string;
  private fetchFn: typeof fetch;

  constructor(options: DocumentSenderOptions) {
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

  async enviarDocumento(input: DocumentoInput): Promise<DocumentoEnviado> {
    const mediaId = await this.uploadMedia(input);
    const messageId = await this.sendDocumentMessage(input, mediaId);
    return { ok: true, mediaId, messageId };
  }

  private async uploadMedia(input: DocumentoInput): Promise<string> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/media`;
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', input.mimeType);
    form.append(
      'file',
      new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
      input.filename
    );

    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form,
    });

    if (!res.ok) {
      throw new Error(
        `Error subiendo media WhatsApp (${res.status}): ${await res.text()}`
      );
    }

    const json = (await res.json()) as { id?: string };
    if (!json.id) {
      throw new Error('Upload de media sin id');
    }
    return json.id;
  }

  private async sendDocumentMessage(
    input: DocumentoInput,
    mediaId: string
  ): Promise<string | undefined> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: input.telefono,
        type: 'document',
        document: {
          id: mediaId,
          filename: input.filename,
          caption: input.caption,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(
        `Error enviando documento WhatsApp (${res.status}): ${await res.text()}`
      );
    }

    const json = (await res.json()) as { messages?: Array<{ id: string }> };
    return json.messages?.[0]?.id;
  }
}

export function createDocumentSender(
  options: DocumentSenderOptions
): IDocumentSender {
  if (options.accessToken && options.phoneNumberId) {
    return new GraphDocumentSender(options);
  }
  console.warn(
    '[whatsapp] Sin credenciales: usando MockDocumentSender para exports'
  );
  return new MockDocumentSender();
}
