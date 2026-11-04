/**
 * Rutas Express del webhook de WhatsApp
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { verificarWebhook, procesarMensaje, type WebhookMessagePayload } from './webhook.js';
import { aceptarRequestFirmado } from './signature.js';
import type { IMediaClient } from './media.js';
import type { AppConfig } from '../config.js';

export type WebhookRouteDeps = {
  config: AppConfig;
  mediaClient: IMediaClient;
  onImage?: Parameters<typeof procesarMensaje>[1] extends infer O
    ? O extends { onImage?: infer F }
      ? F
      : never
    : never;
};

/**
 * Middleware: captura raw body para validar firma HMAC
 * Debe usarse solo en /webhook POST
 */
export function rawBodyMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    (req as Request & { rawBody?: Buffer }).rawBody = raw;
    try {
      req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {};
    } catch {
      req.body = {};
    }
    next();
  });
}

/**
 * Registra GET/POST /webhook
 */
export function registerWebhookRoutes(
  app: Express,
  deps: WebhookRouteDeps
): void {
  const { config, mediaClient, onImage } = deps;

  app.get('/webhook', (req: Request, res: Response) => {
    const mode = String(req.query['hub.mode'] ?? '');
    const token = String(req.query['hub.verify_token'] ?? '');
    const challenge = String(req.query['hub.challenge'] ?? '');

    const result = verificarWebhook(
      { mode, token, challenge },
      config.whatsapp.verifyToken
    );

    if (result !== null) {
      res.status(200).send(result);
      return;
    }

    res.status(403).send('Forbidden');
  });

  app.post('/webhook', (req: Request, res: Response) => {
    const rawBody =
      (req as Request & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(req.body ?? {}));

    const signature = req.header('x-hub-signature-256') ?? undefined;
    const check = aceptarRequestFirmado(
      rawBody,
      signature,
      config.whatsapp.appSecret
    );

    if (!check.ok) {
      res.status(401).json({ error: 'Firma inválida' });
      return;
    }

    // Responder 200 rápido; procesar async
    res.status(200).json({ ok: true });

    const payload = req.body as WebhookMessagePayload;
    console.log('Webhook payload recibido:', JSON.stringify(payload));

    void procesarMensaje(payload, { mediaClient, onImage }).catch((err) => {
      console.error('Error procesando webhook:', err);
    });
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', service: 'ticket-a-ventas' });
  });
}
