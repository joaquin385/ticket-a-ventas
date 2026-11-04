/**
 * Exportación de ventas a CSV y Excel (.xlsx)
 *
 * Columnas en español, montos formateados ARS, hoja Totales en Excel.
 */

import ExcelJS from 'exceljs';
import type { VentaConItems } from '../db/repositories/ventaRepository.js';

export const COLUMNAS_EXPORT = [
  'Fecha',
  'Hora',
  'Producto',
  'Cantidad',
  'Precio Unit.',
  'Subtotal',
  'Total Venta',
  'Medio Pago',
] as const;

export type FilaExport = {
  fecha: string;
  hora: string;
  producto: string;
  cantidad: number;
  precioUnitario: number | null;
  subtotal: number;
  totalVenta: number;
  medioPago: string;
};

export type TotalesExport = {
  cantidadVentas: number;
  cantidadItems: number;
  totalARS: number;
  porMedioPago: Record<string, number>;
};

export type ArchivoExport = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  formato: 'csv' | 'xlsx';
  filas: number;
  totales: TotalesExport;
};

/**
 * Formatea monto en estilo ARS (sin símbolo, con separador de miles argentino)
 * Ej: 3850 → "3.850,00"
 */
export function formatearARS(monto: number): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
}

export function aplanarVentas(ventas: VentaConItems[]): FilaExport[] {
  const filas: FilaExport[] = [];
  for (const venta of ventas) {
    for (const item of venta.items) {
      filas.push({
        fecha: venta.fecha_venta,
        hora: venta.hora_venta ?? '',
        producto: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precio_unitario,
        subtotal: item.subtotal,
        totalVenta: venta.total,
        medioPago: venta.medio_pago ?? '',
      });
    }
  }
  return filas;
}

export function calcularTotales(ventas: VentaConItems[]): TotalesExport {
  const porMedioPago: Record<string, number> = {};
  let totalARS = 0;
  let cantidadItems = 0;

  for (const venta of ventas) {
    totalARS += venta.total;
    cantidadItems += venta.items.length;
    const medio = venta.medio_pago ?? 'sin especificar';
    porMedioPago[medio] = (porMedioPago[medio] ?? 0) + venta.total;
  }

  return {
    cantidadVentas: ventas.length,
    cantidadItems,
    totalARS,
    porMedioPago,
  };
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Genera CSV UTF-8 con BOM (Excel-friendly) y columnas en español
 */
export function generarCSV(ventas: VentaConItems[]): ArchivoExport {
  const filas = aplanarVentas(ventas);
  const totales = calcularTotales(ventas);

  const lines = [
    COLUMNAS_EXPORT.join(','),
    ...filas.map((f) =>
      [
        f.fecha,
        f.hora,
        escapeCsv(f.producto),
        String(f.cantidad),
        f.precioUnitario === null ? '' : formatearARS(f.precioUnitario),
        formatearARS(f.subtotal),
        formatearARS(f.totalVenta),
        escapeCsv(f.medioPago),
      ].join(',')
    ),
    '',
    'Totales',
    `Cantidad de ventas,${totales.cantidadVentas}`,
    `Cantidad de ítems,${totales.cantidadItems}`,
    `Total ARS,${formatearARS(totales.totalARS)}`,
    ...Object.entries(totales.porMedioPago).map(
      ([medio, monto]) => `Total ${medio},${formatearARS(monto)}`
    ),
  ];

  const csv = '\uFEFF' + lines.join('\n');
  return {
    buffer: Buffer.from(csv, 'utf8'),
    filename: 'ventas.csv',
    mimeType: 'text/csv; charset=utf-8',
    formato: 'csv',
    filas: filas.length,
    totales,
  };
}

/**
 * Genera Excel con hoja "Ventas" y hoja "Totales"
 */
export async function generarExcel(
  ventas: VentaConItems[]
): Promise<ArchivoExport> {
  const filas = aplanarVentas(ventas);
  const totales = calcularTotales(ventas);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ticket a Ventas';
  workbook.created = new Date();

  const hojaVentas = workbook.addWorksheet('Ventas');
  hojaVentas.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Hora', key: 'hora', width: 8 },
    { header: 'Producto', key: 'producto', width: 32 },
    { header: 'Cantidad', key: 'cantidad', width: 10 },
    { header: 'Precio Unit.', key: 'precioUnitario', width: 14 },
    { header: 'Subtotal', key: 'subtotal', width: 14 },
    { header: 'Total Venta', key: 'totalVenta', width: 14 },
    { header: 'Medio Pago', key: 'medioPago', width: 14 },
  ];

  hojaVentas.getRow(1).font = { bold: true };

  for (const f of filas) {
    hojaVentas.addRow({
      fecha: f.fecha,
      hora: f.hora,
      producto: f.producto,
      cantidad: f.cantidad,
      precioUnitario:
        f.precioUnitario === null ? '' : formatearARS(f.precioUnitario),
      subtotal: formatearARS(f.subtotal),
      totalVenta: formatearARS(f.totalVenta),
      medioPago: f.medioPago,
    });
  }

  const hojaTotales = workbook.addWorksheet('Totales');
  hojaTotales.columns = [
    { header: 'Concepto', key: 'concepto', width: 28 },
    { header: 'Valor', key: 'valor', width: 18 },
  ];
  hojaTotales.getRow(1).font = { bold: true };
  hojaTotales.addRow({
    concepto: 'Cantidad de ventas',
    valor: totales.cantidadVentas,
  });
  hojaTotales.addRow({
    concepto: 'Cantidad de ítems',
    valor: totales.cantidadItems,
  });
  hojaTotales.addRow({
    concepto: 'Total ARS',
    valor: formatearARS(totales.totalARS),
  });
  for (const [medio, monto] of Object.entries(totales.porMedioPago)) {
    hojaTotales.addRow({
      concepto: `Total ${medio}`,
      valor: formatearARS(monto),
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    filename: 'ventas.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    formato: 'xlsx',
    filas: filas.length,
    totales,
  };
}

export async function generarExport(
  ventas: VentaConItems[],
  formato: 'csv' | 'xlsx',
  etiqueta = 'export'
): Promise<ArchivoExport> {
  const archivo =
    formato === 'csv' ? generarCSV(ventas) : await generarExcel(ventas);
  const ext = formato === 'csv' ? 'csv' : 'xlsx';
  archivo.filename = `ventas-${etiqueta}.${ext}`;
  return archivo;
}
