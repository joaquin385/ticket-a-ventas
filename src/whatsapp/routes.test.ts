/**
 * Tests de rutas Express del webhook
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../index.js';
import { calcularFirma } from './signature.js';

describe('Rutas webhook Express', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'test_verify';
    process.env.WHATSAPP_APP_SECRET = 'test_secret';
    process.env.WHATSAPP_ACCESS_TOKEN = '';

    const { app } = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('No se pudo obtener puerto');
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('GET /webhook debería verificar con token correcto', async () => {
    const url = `${baseUrl}/webhook?hub.mode=subscribe&hub.verify_token=test_verify&hub.challenge=abc123`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('abc123');
  });

  it('GET /webhook debería rechazar token incorrecto', async () => {
    const url = `${baseUrl}/webhook?hub.mode=subscribe&hub.verify_token=malo&hub.challenge=abc`;
    const res = await fetch(url);
    expect(res.status).toBe(403);
  });

  it('POST /webhook debería aceptar payload firmado', async () => {
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [],
    });
    const firma = calcularFirma(body, 'test_secret');
    const res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': firma,
      },
      body,
    });
    expect(res.status).toBe(200);
  });

  it('POST /webhook debería rechazar firma inválida', async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=invalid',
      },
      body,
    });
    expect(res.status).toBe(401);
  });

  it('GET /health debería responder ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe('ok');
  });
});
