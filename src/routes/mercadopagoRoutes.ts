/**
 * Webhook Mercado Pago + retorno de checkout
 *
 * POST /webhooks/mercadopago
 */

import type { Express, Request, Response } from 'express';
import { aceptarWebhookMp } from '../mercadopago/signature.js';
import type { SuscripcionService } from '../services/suscripcionService.js';
import type { IMercadoPagoClient } from '../mercadopago/client.js';

export type MercadoPagoRouteDeps = {
  suscripciones: SuscripcionService;
  mpClient: IMercadoPagoClient;
  webhookSecret: string | null;
};

export function registerMercadoPagoRoutes(
  app: Express,
  deps: MercadoPagoRouteDeps
): void {
  const { suscripciones, mpClient, webhookSecret } = deps;

  app.get('/billing/retorno', (_req: Request, res: Response) => {
    res
      .status(200)
      .send(
        '<html><body><h1>¡Gracias!</h1><p>Si el pago se acreditó, tu plan ya está activo. Volvé a WhatsApp.</p></body></html>'
      );
  });

  app.post('/webhooks/mercadopago', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        type?: string;
        action?: string;
        data?: { id?: string };
      };

      const dataId = String(body.data?.id ?? req.query['data.id'] ?? '');
      if (!dataId) {
        res.status(200).json({ ok: true, skipped: 'sin data.id' });
        return;
      }

      const check = aceptarWebhookMp({
        xSignature: req.header('x-signature') ?? undefined,
        xRequestId: req.header('x-request-id') ?? undefined,
        dataId,
        secret: webhookSecret,
      });

      if (!check.ok) {
        res.status(401).json({ error: 'Firma inválida' });
        return;
      }

      // Consultar preapproval actualizado
      const preapproval = await mpClient.obtenerPreapproval(dataId);
      const updated = await suscripciones.aplicarEstadoDesdeMp(
        preapproval.id,
        preapproval.status
      );

      res.status(200).json({
        ok: true,
        suscripcionId: updated?.id ?? null,
        estado: updated?.estado ?? null,
      });
    } catch (err) {
      console.error('Error webhook Mercado Pago:', err);
      res.status(500).json({ error: 'Error procesando webhook' });
    }
  });
}
