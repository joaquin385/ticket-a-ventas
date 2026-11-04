/**
 * Punto de entrada principal de Ticket a Ventas
 *
 * M1 webhook · M2 extracción · M3 persistencia · M4 export
 */

import express from 'express';
import { loadConfig } from './config.js';
import { createMediaClient } from './whatsapp/media.js';
import { registerWebhookRoutes, rawBodyMiddleware } from './whatsapp/routes.js';
import { createExtractor } from './extraction/extractor.js';
import { createRepositories } from './db/repositories/index.js';
import { createStorage } from './storage/storage.js';
import { createWhatsAppSender } from './whatsapp/sender.js';
import { createDocumentSender } from './whatsapp/documentSender.js';
import { VentaService } from './services/ventaService.js';
import { ExportHandler } from './services/exportHandler.js';
import { registerExportRoutes } from './routes/exportRoutes.js';

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
  const documentSender = createDocumentSender({
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

  const exportHandler = new ExportHandler({
    repos,
    sender,
    documentSender,
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
    onText: async (from, body) => {
      try {
        const handled = await exportHandler.manejarTextoWhatsApp(from, body);
        if (!handled) {
          console.log('Texto sin comando reconocido:', body);
        }
      } catch (err) {
        console.error('Error procesando comando de texto:', err);
        await sender.enviarMensaje(
          from,
          'Hubo un error al exportar. Probá de nuevo en un rato.'
        );
      }
    },
  });

  registerExportRoutes(app, {
    exportHandler,
    apiToken: config.exportApiToken,
  });

  return {
    app,
    config,
    ventaService,
    exportHandler,
    repos,
    storage,
    sender,
    documentSender,
    extractor,
  };
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
    if (!config.exportApiToken) {
      console.warn('GET /api/export requiere EXPORT_API_TOKEN');
    }
  });
}
