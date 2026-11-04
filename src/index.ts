/**
 * Punto de entrada principal de Ticket a Ventas
 *
 * Levanta Express y expone el webhook de WhatsApp (M1+)
 */

import express from 'express';
import { loadConfig } from './config.js';
import { createMediaClient } from './whatsapp/media.js';
import { registerWebhookRoutes, rawBodyMiddleware } from './whatsapp/routes.js';

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

  registerWebhookRoutes(app, {
    config,
    mediaClient,
    // onImage se cablea en M2/M3
  });

  return { app, config };
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
