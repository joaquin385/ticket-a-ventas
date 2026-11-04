import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../index.js';
import { MemoryStore } from '../db/memoryStore.js';
import { createRepositories } from '../db/repositories/index.js';
import { loadConfig } from '../config.js';
import { VentaExtractedSchema } from '../extraction/schema.js';
import alta from '../extraction/fixtures/venta-alta-confianza.json' with { type: 'json' };
import ExcelJS from 'exceljs';

describe('GET /api/export', () => {
  let server: Server;
  let baseUrl: string;
  let comercioId: string;

  beforeAll(async () => {
    process.env.EXPORT_API_TOKEN = 'test-export-token';
    process.env.DATABASE_URL = '';
    process.env.WHATSAPP_ACCESS_TOKEN = '';
    process.env.WHATSAPP_APP_SECRET = '';
    process.env.VISION_API_KEY = '';

    const { app, repos } = createApp();

    // Sembrar ventas en el store compartido del app (memory mode)
    const { comercio } = await repos.comercios.encontrarOCrearPorTelefono(
      '5491188887777',
      'Kiosco Test'
    );
    comercioId = comercio.id;
    const hoy = new Date().toISOString().slice(0, 10);
    await repos.ventas.crear({
      foto_id: null,
      comercio_id: comercioId,
      extracted: VentaExtractedSchema.parse({ ...alta, fecha: hoy }),
      requiere_revision: false,
    });
    // guardar fechas para queries
    (globalThis as { __exportTestDates?: { desde: string; hasta: string } }).__exportTestDates =
      { desde: hoy, hasta: hoy };

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

  it('debería rechazar sin Bearer token', async () => {
    const { desde, hasta } = (
      globalThis as { __exportTestDates: { desde: string; hasta: string } }
    ).__exportTestDates;
    const res = await fetch(
      `${baseUrl}/api/export?comercio_id=${comercioId}&desde=${desde}&hasta=${hasta}`
    );
    expect(res.status).toBe(401);
  });

  it('debería rechazar token incorrecto', async () => {
    const { desde, hasta } = (
      globalThis as { __exportTestDates: { desde: string; hasta: string } }
    ).__exportTestDates;
    const res = await fetch(
      `${baseUrl}/api/export?comercio_id=${comercioId}&desde=${desde}&hasta=${hasta}`,
      { headers: { Authorization: 'Bearer wrong' } }
    );
    expect(res.status).toBe(401);
  });

  it('debería devolver xlsx autenticado', async () => {
    const { desde, hasta } = (
      globalThis as { __exportTestDates: { desde: string; hasta: string } }
    ).__exportTestDates;
    const res = await fetch(
      `${baseUrl}/api/export?comercio_id=${comercioId}&desde=${desde}&hasta=${hasta}&formato=xlsx`,
      { headers: { Authorization: 'Bearer test-export-token' } }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
    const buf = Buffer.from(await res.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    // exceljs tipa load como ArrayBuffer
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Ventas')).toBeTruthy();
    expect(wb.getWorksheet('Totales')).toBeTruthy();
  });

  it('debería devolver csv autenticado', async () => {
    const { desde, hasta } = (
      globalThis as { __exportTestDates: { desde: string; hasta: string } }
    ).__exportTestDates;
    const res = await fetch(
      `${baseUrl}/api/export?comercio_id=${comercioId}&desde=${desde}&hasta=${hasta}&formato=csv`,
      { headers: { Authorization: 'Bearer test-export-token' } }
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Fecha,Hora,Producto');
    expect(text).toContain('Totales');
  });

  it('debería validar parámetros', async () => {
    const res = await fetch(`${baseUrl}/api/export?comercio_id=x`, {
      headers: { Authorization: 'Bearer test-export-token' },
    });
    expect(res.status).toBe(400);
  });
});

describe('MemoryStore seed helper', () => {
  it('smoke createRepositories', () => {
    const store = new MemoryStore();
    const repos = createRepositories(
      loadConfig({ ...process.env, DATABASE_URL: '' }),
      store
    );
    expect(repos.mode).toBe('memory');
  });
});
