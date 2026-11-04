/**
 * Extractor de datos de fotos de tickets
 *
 * - MockExtractor: fixtures / datos de prueba
 * - VisionLLMExtractor: API OpenAI-compatible (GPT-4o, etc.)
 */

import {
  VentaExtractedSchema,
  requiereRevision,
  type VentaExtracted,
} from './schema.js';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_JSON_SCHEMA } from './prompt.js';
import type { AppConfig } from '../config.js';
import altaConfianza from './fixtures/venta-alta-confianza.json' with { type: 'json' };
import bajaConfianza from './fixtures/venta-baja-confianza.json' with { type: 'json' };

export type ExtractResult = {
  venta: VentaExtracted;
  bajaConfianza: boolean;
};

/**
 * Interfaz para extractores de datos de tickets
 */
export interface IExtractor {
  /**
   * Extrae datos estructurados de una foto de ticket
   *
   * @param imageUrl - URL o data URL de la imagen
   */
  extract(imageUrl: string): Promise<VentaExtracted>;

  /**
   * Extrae y marca si requiere revisión por baja confianza
   */
  extractWithFlags?(imageUrl: string): Promise<ExtractResult>;
}

function withFlags(venta: VentaExtracted): ExtractResult {
  return {
    venta,
    bajaConfianza: requiereRevision(venta),
  };
}

/**
 * Mock: usa fixtures según el nombre de la URL
 */
export class MockExtractor implements IExtractor {
  constructor(private readonly fixture: 'alta' | 'baja' = 'alta') {}

  async extract(imageUrl: string): Promise<VentaExtracted> {
    await new Promise((resolve) => setTimeout(resolve, 20));
    console.log('MockExtractor procesando:', imageUrl);

    const raw =
      this.fixture === 'baja' || imageUrl.includes('baja')
        ? bajaConfianza
        : altaConfianza;

    return VentaExtractedSchema.parse(raw);
  }

  async extractWithFlags(imageUrl: string): Promise<ExtractResult> {
    return withFlags(await this.extract(imageUrl));
  }
}

export type VisionLLMOptions = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetchFn?: typeof fetch;
};

/**
 * Extractor real vía chat completions OpenAI-compatible + vision
 */
export class VisionLLMExtractor implements IExtractor {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private fetchFn: typeof fetch;

  constructor(options: VisionLLMOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(
      /\/$/,
      ''
    );
    this.model = options.model ?? 'gpt-4o';
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async extract(imageUrl: string): Promise<VentaExtracted> {
    const body = {
      model: this.model,
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: EXTRACTION_JSON_SCHEMA,
      },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extraé los datos de venta de esta imagen.',
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    };

    const res = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vision LLM error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Vision LLM: respuesta vacía');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Algunos modelos envuelven en ```json
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Vision LLM: no se pudo parsear JSON');
      }
      parsed = JSON.parse(match[0]);
    }

    return VentaExtractedSchema.parse(parsed);
  }

  async extractWithFlags(imageUrl: string): Promise<ExtractResult> {
    return withFlags(await this.extract(imageUrl));
  }
}

/**
 * Factory según config: mock si no hay API key
 */
export function createExtractor(config: AppConfig): IExtractor {
  if (!config.vision.apiKey || config.vision.provider === 'mock') {
    console.warn('[extraction] Sin VISION_API_KEY: usando MockExtractor');
    return new MockExtractor('alta');
  }

  return new VisionLLMExtractor({
    apiKey: config.vision.apiKey,
    baseUrl: config.vision.baseUrl,
    model: config.vision.model,
  });
}

/**
 * Convierte un buffer de imagen a data URL para el LLM
 */
export function bufferToDataUrl(
  buffer: Buffer,
  mimeType = 'image/jpeg'
): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
