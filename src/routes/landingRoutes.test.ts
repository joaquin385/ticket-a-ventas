import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../index.js';

describe('Landing /landing', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.LANDING_WHATSAPP_NUMBER = '5491198765432';
    process.env.DATABASE_URL = '';
    process.env.WHATSAPP_ACCESS_TOKEN = '';
    process.env.ADMIN_API_TOKEN = 'x';

    const { app } = createApp();
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

  it('debería servir HTML con marca, precio y wa.me', async () => {
    const res = await fetch(`${baseUrl}/landing`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Ticket a');
    expect(html).toContain('7.000');
    expect(html).toContain('5491198765432');
    expect(html).toContain('wa.me');
  });
});
