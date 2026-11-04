/**
 * Punto de entrada principal de Ticket a Ventas
 *
 * Levanta Express y expone el webhook de WhatsApp (M1+)
 */

import express from 'express';
import { loadConfig } from './config.js';
import { createMediaClient } from './whatsapp/media.js';
import { registerWebhookRoutes, rawBodyMiddleware } from './whatsapp/routes.js';
import { createExtractor, bufferToDataUrl } from './extraction/extractor.js';

export const APP_VERSION = '0.1.0';

export function createApp() {
  const config = loadConfig();
  const app = express();

  // Raw body solo para POST /webhook (firma HMAC); no usar express.json ahí
  app.use('/webhook', (req, res, next) => {
    if (req.method === 'POST') {
      rawBodyMiddleware(req, res, next);
      return;
    }
    next();
  });

  app.use((req, res, next) => {
    if (req.path === '/webhook' && req.method === 'POST') {
      next();
      return;
    }
    express.json()(req, res, next);
  });

  const mediaClient = createMediaClient({
    accessToken: config.whatsapp.accessToken,
    apiVersion: config.whatsapp.apiVersion,
  });

  const extractor = createExtractor(config);

  registerWebhookRoutes(app, {
    config,
    mediaClient,
    onImage: async (imagen) => {
      const dataUrl = bufferToDataUrl(imagen.buffer, imagen.mimeType);
      const extract =
        extractor.extractWithFlags?.bind(extractor) ??
        (async (url: string) => {
          const venta = await extractor.extract(url);
          return { venta, bajaConfianza: venta.confianza < config.minConfidenceScore };
        });
      const result = await extract(dataUrl);
      console.log('Extracción:', {
        from: imagen.from,
        total: result.venta.total,
        items: result.venta.items.length,
        confianza: result.venta.confianza,
        bajaConfianza: result.bajaConfianza,
      });
      // Persistencia + reply en M3
    },
  });

  return { app, config, extractor };
}

// Arranque solo si se ejecuta directamente (no en tests)
const isMain =
  process.argv[1]?.includes('src/index') ||
  process.argv[1]?.includes('dist/index');

if (isMain) {
  const { app, config } = createApp();
  app.listen(config.port, () => {
    console.log(
      `Ticket a Ventas v${APP_VERSION} escuchando en :${config.port}`
    );
    console.log(
      `Webhook verify token: ${config.whatsapp.verifyToken ? '(configurado)' : '(default)'}`
    );
    if (!config.whatsapp.accessToken) {
      console.warn('Modo mock: sin WHATSAPP_ACCESS_TOKEN');
    }
  });
}
