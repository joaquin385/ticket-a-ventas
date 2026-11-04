/**
 * Descarga de media (fotos) vía WhatsApp Graph API
 */

export type MediaDownloadResult = {
  mediaId: string;
  mimeType: string;
  buffer: Buffer;
  url: string;
};

export type MediaClientOptions = {
  accessToken: string | null;
  apiVersion?: string;
  fetchFn?: typeof fetch;
};

/**
 * Interfaz para descargar media (permite mock en tests)
 */
export interface IMediaClient {
  download(mediaId: string): Promise<MediaDownloadResult>;
}

/**
 * Cliente real de Graph API
 *
 * 1) GET /{media-id} → url temporal
 * 2) GET url con Authorization → bytes
 */
export class GraphMediaClient implements IMediaClient {
  private accessToken: string;
  private apiVersion: string;
  private fetchFn: typeof fetch;

  constructor(options: MediaClientOptions) {
    if (!options.accessToken) {
      throw new Error('WHATSAPP_ACCESS_TOKEN requerido para GraphMediaClient');
    }
    this.accessToken = options.accessToken;
    this.apiVersion = options.apiVersion ?? 'v21.0';
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async download(mediaId: string): Promise<MediaDownloadResult> {
    const metaUrl = `https://graph.facebook.com/${this.apiVersion}/${mediaId}`;
    const metaRes = await this.fetchFn(metaUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!metaRes.ok) {
      throw new Error(
        `Error obteniendo metadata de media ${mediaId}: ${metaRes.status}`
      );
    }

    const meta = (await metaRes.json()) as {
      url?: string;
      mime_type?: string;
    };

    if (!meta.url) {
      throw new Error(`Media ${mediaId} sin URL temporal`);
    }

    const binRes = await this.fetchFn(meta.url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!binRes.ok) {
      throw new Error(
        `Error descargando media ${mediaId}: ${binRes.status}`
      );
    }

    const arrayBuffer = await binRes.arrayBuffer();
    return {
      mediaId,
      mimeType: meta.mime_type ?? 'image/jpeg',
      buffer: Buffer.from(arrayBuffer),
      url: meta.url,
    };
  }
}

/**
 * Mock: no llama a Graph API; retorna un JPEG mínimo + URL ficticia
 */
export class MockMediaClient implements IMediaClient {
  async download(mediaId: string): Promise<MediaDownloadResult> {
    // JPEG mínimo válido (1x1 pixel)
    const buffer = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
      'base64'
    );

    return {
      mediaId,
      mimeType: 'image/jpeg',
      buffer,
      url: `https://mock.whatsapp.local/media/${mediaId}`,
    };
  }
}

/**
 * Factory: usa Graph API si hay token; si no, mock
 */
export function createMediaClient(options: MediaClientOptions): IMediaClient {
  if (options.accessToken) {
    return new GraphMediaClient(options);
  }
  console.warn('[whatsapp] Sin WHATSAPP_ACCESS_TOKEN: usando MockMediaClient');
  return new MockMediaClient();
}
