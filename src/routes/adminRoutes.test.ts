import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../index.js';
import { VentaExtractedSchema } from '../extraction/schema.js';

describe('Admin revisión', () => {
  let server: Server;
  let baseUrl: string;
  let ventaId: string;

  beforeAll(async () => {
    process.env.ADMIN_API_TOKEN = 'admin-secret';
    process.env.DATABASE_URL = '';
    process.env.WHATSAPP_ACCESS_TOKEN = '';
    process.env.WHATSAPP_APP_SECRET = '';
    process.env.VISION_API_KEY = '';
    process.env.MERCADOPAGO_ACCESS_TOKEN = '';

    const { app, repos } = createApp();
    const { comercio, usuario } =
      await repos.comercios.encontrarOCrearPorTelefono(
        '5491133322211',
        'Admin Test'
      );
    const foto = await repos.fotos.guardar({
      comercio_id: comercio.id,
      usuario_id: usuario.id,
      whatsapp_media_id: 'mx',
      url_foto: 'https://example.com/t.jpg',
    });
    const venta = await repos.ventas.crear({
      foto_id: foto.id,
      comercio_id: comercio.id,
      extracted: VentaExtractedSchema.parse({
        fecha: '2024-11-04',
        items: [
          {
            descripcion: 'x',
            cantidad: 1,
            precio_unitario: 10,
            subtotal: 10,
          },
        ],
        total: 10,
        medio_pago: 'efectivo',
        confianza: 0.3,
      }),
      requiere_revision: true,
    });
    ventaId = venta.id;

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

  it('GET /admin debería servir HTML', async () => {
    const res = await fetch(`${baseUrl}/admin`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/revisión|Cola/i);
  });

  it('API debería exigir token', async () => {
    const res = await fetch(`${baseUrl}/admin/api/ventas/revision`);
    expect(res.status).toBe(401);
  });

  it('debería listar, editar y aprobar', async () => {
    const headers = {
      Authorization: 'Bearer admin-secret',
      'Content-Type': 'application/json',
    };
    const list = await fetch(`${baseUrl}/admin/api/ventas/revision`, {
      headers,
    });
    expect(list.status).toBe(200);
    const arr = (await list.json()) as unknown[];
    expect(arr.length).toBeGreaterThanOrEqual(1);

    const put = await fetch(`${baseUrl}/admin/api/ventas/${ventaId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        total: 99,
        items: [
          {
            descripcion: 'corregido',
            cantidad: 1,
            subtotal: 99,
            precio_unitario: 99,
          },
        ],
      }),
    });
    expect(put.status).toBe(200);

    const apr = await fetch(
      `${baseUrl}/admin/api/ventas/${ventaId}/aprobar`,
      { method: 'POST', headers, body: '{}' }
    );
    expect(apr.status).toBe(200);
    const body = (await apr.json()) as { revisada: boolean };
    expect(body.revisada).toBe(true);
  });
});
