/**
 * Punto de entrada principal de Ticket a Ventas
 *
 * M1–M6: webhook, extracción, persistencia, export, insights, billing MP
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
import { createMercadoPagoClient } from './mercadopago/client.js';
import { VentaService } from './services/ventaService.js';
import { ExportHandler } from './services/exportHandler.js';
import { InsightsHandler } from './services/insightsHandler.js';
import { SuscripcionService } from './services/suscripcionService.js';
import { BillingHandler } from './services/billingHandler.js';
import { registerExportRoutes } from './routes/exportRoutes.js';
import { registerJobsRoutes } from './routes/jobsRoutes.js';
import { registerMercadoPagoRoutes } from './routes/mercadopagoRoutes.js';
import { parsearComando } from './whatsapp/commands.js';

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
  const mpClient = createMercadoPagoClient({
    accessToken: config.mercadopago.accessToken,
  });

  const suscripciones = new SuscripcionService(repos, mpClient, {
    precioMensualArs: config.billing.precioMensualArs,
    trialDias: config.billing.trialDias,
    trialFotos: config.billing.trialFotos,
    baseUrl: config.baseUrl,
  });

  const ventaService = new VentaService({
    repos,
    storage,
    extractor,
    sender,
    minConfidence: config.minConfidenceScore,
    suscripciones,
  });

  const exportHandler = new ExportHandler({
    repos,
    sender,
    documentSender,
  });

  const insightsHandler = new InsightsHandler({ repos, sender });
  const billingHandler = new BillingHandler({
    repos,
    sender,
    suscripciones,
    precioMensualArs: config.billing.precioMensualArs,
  });

  registerWebhookRoutes(app, {
    config,
    mediaClient,
    onImage: async (imagen) => {
      try {
        const result = await ventaService.procesarImagen(imagen);
        console.log('Venta procesada:', {
          from: imagen.from,
          ventaId: result.venta?.id ?? null,
          bloqueado: result.bloqueado ?? false,
          bajaConfianza: result.bajaConfianza,
        });
      } catch (err) {
        console.error('Error en pipeline de venta:', err);
      }
    },
    onText: async (from, body) => {
      try {
        const comando = parsearComando(body);
        if (comando.tipo === 'resumen') {
          await insightsHandler.manejarResumen(from);
          return;
        }
        if (comando.tipo === 'pronostico') {
          await insightsHandler.manejarPronostico(from);
          return;
        }
        if (comando.tipo === 'exportar') {
          await exportHandler.manejarTextoWhatsApp(from, body);
          return;
        }
        if (comando.tipo === 'suscribirme') {
          await billingHandler.manejarSuscribirme(from);
          return;
        }
        if (comando.tipo === 'estado') {
          await billingHandler.manejarEstado(from);
          return;
        }
        console.log('Texto sin comando reconocido:', body);
      } catch (err) {
        console.error('Error procesando comando de texto:', err);
        await sender.enviarMensaje(
          from,
          'Hubo un error procesando tu pedido. Probá de nuevo en un rato.'
        );
      }
    },
  });

  registerExportRoutes(app, {
    exportHandler,
    apiToken: config.exportApiToken,
  });

  registerJobsRoutes(app, {
    insightsHandler,
    jobsApiToken: config.jobsApiToken,
  });

  registerMercadoPagoRoutes(app, {
    suscripciones,
    mpClient,
    webhookSecret: config.mercadopago.webhookSecret,
  });

  return {
    app,
    config,
    ventaService,
    exportHandler,
    insightsHandler,
    billingHandler,
    suscripciones,
    repos,
    storage,
    sender,
    documentSender,
    extractor,
    mpClient,
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
    if (!config.mercadopago.accessToken) {
      console.warn('Modo mock: sin MERCADOPAGO_ACCESS_TOKEN');
    }
    if (!config.exportApiToken) {
      console.warn('GET /api/export requiere EXPORT_API_TOKEN');
    }
    if (!config.jobsApiToken) {
      console.warn('POST /api/jobs/* requiere JOBS_API_TOKEN');
    }
  });
}
