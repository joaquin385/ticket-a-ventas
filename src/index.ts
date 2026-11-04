/**
 * Punto de entrada principal de Ticket a Ventas
 *
 * M1 webhook · M2 extracción · M3 persistencia + reply
 */

import express from 'express';
import { loadConfig } from './config.js';
import { createMediaClient } from './whatsapp/media.js';
import { registerWebhookRoutes, rawBodyMiddleware } from './whatsapp/routes.js';
import { createExtractor } from './extraction/extractor.js';
import { createRepositories } from './db/repositories/index.js';
import { createStorage } from './storage/storage.js';
import { createWhatsAppSender } from './whatsapp/sender.js';
import { VentaService } from './services/ventaService.js';

export const APP_VERSION = '0.1.0';

export function createApp() {
  const config = loadConfig();
  const app = express();

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
  const repos = createRepositories(config);
  const storage = createStorage(config);
  const sender = createWhatsAppSender({
    accessToken: config.whatsapp.accessToken,
    phoneNumberId: config.whatsapp.phoneNumberId,
    apiVersion: config.whatsapp.apiVersion,
  });

  const ventaService = new VentaService({
    repos,
    storage,
    extractor,
    sender,
    minConfidence: config.minConfidenceScore,
  });

  registerWebhookRoutes(app, {
    config,
    mediaClient,
    onImage: async (imagen) => {
      try {
        const result = await ventaService.procesarImagen(imagen);
        console.log('Venta procesada:', {
          from: imagen.from,
          ventaId: result.venta.id,
          total: result.venta.total,
          bajaConfianza: result.bajaConfianza,
        });
      } catch (err) {
        console.error('Error en pipeline de venta:', err);
      }
    },
  });

  return { app, config, ventaService, repos, storage, sender, extractor };
}

const isMain =
  process.argv[1]?.includes('src/index') ||
  process.argv[1]?.includes('dist/index');

if (isMain) {
  const { app, config } = createApp();
  app.listen(config.port, () => {
    console.log(
      `Ticket a Ventas v${APP_VERSION} escuchando en :${config.port}`
    );
    if (!config.whatsapp.accessToken) {
      console.warn('Modo mock: sin WHATSAPP_ACCESS_TOKEN');
    }
    if (!config.databaseUrl) {
      console.warn('Modo mock: sin DATABASE_URL (memoria)');
    }
    if (!config.vision.apiKey) {
      console.warn('Modo mock: sin VISION_API_KEY');
    }
  });
}
