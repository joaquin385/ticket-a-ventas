import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../index.js';
import { VentaExtractedSchema } from '../extraction/schema.js';

describe('POST /api/jobs/resumen-semanal', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.JOBS_API_TOKEN = 'jobs-secret';
    process.env.EXPORT_API_TOKEN = 'jobs-secret';
    process.env.DATABASE_URL = '';
    process.env.WHATSAPP_ACCESS_TOKEN = '';
    process.env.WHATSAPP_APP_SECRET = '';
    process.env.VISION_API_KEY = '';

    const { app, repos } = createApp();
    const { comercio } = await repos.comercios.encontrarOCrearPorTelefono(
      '5491177776666',
      'Verdulería Sur'
    );
    await repos.ventas.crear({
      foto_id: null,
      comercio_id: comercio.id,
      extracted: VentaExtractedSchema.parse({
        fecha: '2024-11-05',
        items: [
          {
            descripcion: 'Tomate',
            cantidad: 2,
            precio_unitario: 500,
            subtotal: 1000,
          },
        ],
        total: 1000,
        medio_pago: 'efectivo',
        confianza: 0.9,
      }),
      requiere_revision: false,
    });

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

  it('debería rechazar sin token', async () => {
    const res = await fetch(`${baseUrl}/api/jobs/resumen-semanal`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('debería ejecutar el job con Bearer token', async () => {
    const res = await fetch(
      `${baseUrl}/api/jobs/resumen-semanal?fecha=2024-11-11T12:00:00.000Z`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer jobs-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      enviados: number;
      ejecutadoEn: string;
    };
    expect(json.enviados).toBeGreaterThanOrEqual(1);
    expect(json.ejecutadoEn).toBeTruthy();
  });
});
