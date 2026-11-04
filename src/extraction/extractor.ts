/**
 * Extractor de datos de fotos de tickets
 * 
 * Define la interfaz y provee una implementación mock para testing
 */

import type { VentaExtracted } from './schema.js';

/**
 * Interfaz para extractores de datos de tickets
 */
export interface IExtractor {
  /**
   * Extrae datos estructurados de una foto de ticket
   * 
   * @param imageUrl - URL de la imagen a procesar
   * @returns Datos extraídos con score de confianza
   */
  extract(imageUrl: string): Promise<VentaExtracted>;
}

/**
 * Implementación mock del extractor para testing y desarrollo
 * 
 * Retorna datos hardcodeados con alta confianza
 */
export class MockExtractor implements IExtractor {
  async extract(imageUrl: string): Promise<VentaExtracted> {
    // Simular latencia de API
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Log para debug
    console.log('MockExtractor procesando:', imageUrl);

    // Retornar datos de ejemplo
    return {
      fecha: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      hora: '14:30',
      items: [
        {
          descripcion: 'Coca Cola 2.25L',
          cantidad: 2,
          precio_unitario: 850.0,
          subtotal: 1700.0,
        },
        {
          descripcion: 'Pan lactal',
          cantidad: 1,
          precio_unitario: 1200.0,
          subtotal: 1200.0,
        },
        {
          descripcion: 'Leche entera 1L',
          cantidad: 1,
          precio_unitario: 950.0,
          subtotal: 950.0,
        },
      ],
      total: 3850.0,
      medio_pago: 'efectivo',
      confianza: 0.95,
    };
  }
}

/**
 * Implementación real del extractor usando Vision LLM
 * 
 * TODO: Implementar en Milestone 2 con OpenAI GPT-4V o Claude 3.5 Sonnet
 */
export class VisionLLMExtractor implements IExtractor {
  private apiKey: string;
  private provider: 'openai' | 'anthropic';

  constructor(apiKey: string, provider: 'openai' | 'anthropic' = 'openai') {
    this.apiKey = apiKey;
    this.provider = provider;
  }

  async extract(imageUrl: string): Promise<VentaExtracted> {
    // TODO: Implementar llamada a API de Vision
    throw new Error(
      'VisionLLMExtractor no implementado aún. Usar MockExtractor.'
    );
  }
}
