import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  generarCSV,
  generarExcel,
  formatearARS,
  aplanarVentas,
  COLUMNAS_EXPORT,
} from './exportService.js';
import type { VentaConItems } from '../db/repositories/ventaRepository.js';

const ventasFixture: VentaConItems[] = [
  {
    id: 'v1',
    foto_id: null,
    comercio_id: 'c1',
    fecha_venta: '2024-11-04',
    hora_venta: '14:30',
    total: 3850,
    medio_pago: 'efectivo',
    confianza_score: 0.95,
    requiere_revision: false,
    revisada: false,
    datos_raw: null,
    creada_en: new Date(),
    items: [
      {
        id: 'i1',
        venta_id: 'v1',
        descripcion: 'Coca Cola 2.25L',
        cantidad: 2,
        precio_unitario: 850,
        subtotal: 1700,
        orden: 0,
      },
      {
        id: 'i2',
        venta_id: 'v1',
        descripcion: 'Pan lactal',
        cantidad: 1,
        precio_unitario: 2150,
        subtotal: 2150,
        orden: 1,
      },
    ],
  },
];

describe('exportService', () => {
  it('formatearARS debería usar formato es-AR', () => {
    expect(formatearARS(3850)).toMatch(/3.?850,00/);
  });

  it('aplanarVentas debería generar una fila por ítem', () => {
    expect(aplanarVentas(ventasFixture)).toHaveLength(2);
  });

  it('generarCSV debería incluir columnas en español y totales', () => {
    const archivo = generarCSV(ventasFixture);
    const text = archivo.buffer.toString('utf8');
    expect(archivo.formato).toBe('csv');
    expect(text).toContain(COLUMNAS_EXPORT.join(','));
    expect(text).toContain('Coca Cola 2.25L');
    expect(text).toContain('Totales');
    expect(text).toContain('Total ARS');
    expect(archivo.totales.cantidadVentas).toBe(1);
    expect(archivo.totales.totalARS).toBe(3850);
  });

  it('generarExcel debería crear hojas Ventas y Totales', async () => {
    const archivo = await generarExcel(ventasFixture);
    expect(archivo.formato).toBe('xlsx');
    expect(archivo.mimeType).toContain('spreadsheetml');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(archivo.buffer as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Ventas')).toBeTruthy();
    expect(wb.getWorksheet('Totales')).toBeTruthy();

    const ventasSheet = wb.getWorksheet('Ventas')!;
    expect(ventasSheet.getRow(1).getCell(1).value).toBe('Fecha');
    expect(ventasSheet.getRow(1).getCell(3).value).toBe('Producto');
    expect(ventasSheet.rowCount).toBeGreaterThanOrEqual(3);

    const totalesSheet = wb.getWorksheet('Totales')!;
    const conceptos: string[] = [];
    totalesSheet.eachRow((row, n) => {
      if (n > 1) conceptos.push(String(row.getCell(1).value));
    });
    expect(conceptos).toContain('Total ARS');
    expect(conceptos.some((c) => c.includes('efectivo'))).toBe(true);
  });
});
