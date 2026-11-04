import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../index.js';
import {
  construirManifest,
  calcularFirmaMp,
} from '../mercadopago/signature.js';
import type { MockMercadoPagoClient } from '../mercadopago/client.js';

describe('Webhook Mercado Pago', () => {
  let server: Server;
  let baseUrl: string;
  const secret = 'mp-test-secret';

  beforeAll(async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    process.env.MERCADOPAGO_ACCESS_TOKEN = '';
    process.env.DATABASE_URL = '';
    process.env.WHATSAPP_ACCESS_TOKEN = '';
    process.env.WHATSAPP_APP_SECRET = '';
    process.env.VISION_API_KEY = '';

    const { app, repos, mpClient, suscripciones } = createApp();

    const { comercio } = await repos.comercios.encontrarOCrearPorTelefono(
      '5491166655544',
      'Almacén MP'
    );
    const { suscripcion } = await suscripciones.obtenerLinkPago(comercio.id);
    (globalThis as { __mpPreapprovalId?: string }).__mpPreapprovalId =
      suscripcion.mercadopago_preapproval_id!;

    (mpClient as MockMercadoPagoClient).setStatus(
      suscripcion.mercadopago_preapproval_id!,
      'authorized'
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('sin puerto');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('debería rechazar firma inválida', async () => {
    const res = await fetch(`${baseUrl}/webhooks/mercadopago`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': 'ts=1,v1=bad',
        'x-request-id': 'r1',
      },
      body: JSON.stringify({ data: { id: 'x' } }),
    });
    expect(res.status).toBe(401);
  });

  it('debería actualizar suscripción con firma válida', async () => {
    const dataId = (globalThis as { __mpPreapprovalId: string })
      .__mpPreapprovalId;
    const ts = '1700000000';
    const requestId = 'req-mp-1';
    const v1 = calcularFirmaMp(
      construirManifest(dataId, requestId, ts),
      secret
    );

    const res = await fetch(`${baseUrl}/webhooks/mercadopago`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': `ts=${ts},v1=${v1}`,
        'x-request-id': requestId,
      },
      body: JSON.stringify({
        type: 'subscription_preapproval',
        data: { id: dataId },
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { estado: string };
    expect(json.estado).toBe('activa');
  });
});
