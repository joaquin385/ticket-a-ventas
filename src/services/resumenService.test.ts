import { describe, it, expect } from 'vitest';
import {
  calcularVentanaSemanal,
  ventanaSemanaAnteriorParaLunes,
  calcularResumenSemanal,
  formatearResumenSemanal,
} from './resumenService.js';
import type { VentaConItems } from '../db/repositories/ventaRepository.js';

function venta(
  fecha: string,
  total: number,
  items: Array<{ descripcion: string; cantidad: number; subtotal: number }>,
  medio: string | null = 'efectivo'
): VentaConItems {
  return {
    id: `v-${fecha}-${total}`,
    foto_id: null,
    comercio_id: 'c1',
    fecha_venta: fecha,
    hora_venta: '12:00',
    total,
    medio_pago: medio,
    confianza_score: 0.9,
    requiere_revision: false,
    revisada: false,
    datos_raw: null,
    creada_en: new Date(),
    items: items.map((it, i) => ({
      id: `i-${fecha}-${i}`,
      venta_id: `v-${fecha}-${total}`,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.subtotal / it.cantidad,
      subtotal: it.subtotal,
      orden: i,
    })),
  };
}

describe('resumenService', () => {
  it('calcularVentanaSemanal debería cubrir 7 + 7 días', () => {
    const v = calcularVentanaSemanal(new Date('2024-11-10T12:00:00Z'));
    expect(v.hasta).toBe('2024-11-10');
    expect(v.desde).toBe('2024-11-04');
    expect(v.anteriorHasta).toBe('2024-11-03');
    expect(v.anteriorDesde).toBe('2024-10-28');
  });

  it('ventanaSemanaAnteriorParaLunes debería apuntar al domingo previo', () => {
    // Lunes 11 nov 2024 → semana lun 4 – dom 10
    const v = ventanaSemanaAnteriorParaLunes(
      new Date('2024-11-11T15:00:00Z')
    );
    expect(v.desde).toBe('2024-11-04');
    expect(v.hasta).toBe('2024-11-10');
  });

  it('debería calcular totales, ticket, top y variación', () => {
    const ventana = calcularVentanaSemanal(new Date('2024-11-10T12:00:00Z'));
    const semana = [
      venta('2024-11-05', 1000, [
        { descripcion: 'Coca', cantidad: 2, subtotal: 1000 },
      ]),
      venta('2024-11-07', 2000, [
        { descripcion: 'Pan', cantidad: 1, subtotal: 500 },
        { descripcion: 'Coca', cantidad: 1, subtotal: 1500 },
      ]),
    ];
    const anterior = [
      venta('2024-10-30', 2000, [
        { descripcion: 'Leche', cantidad: 1, subtotal: 2000 },
      ]),
    ];

    const r = calcularResumenSemanal(semana, anterior, ventana);
    expect(r.totalVendido).toBe(3000);
    expect(r.cantidadVentas).toBe(2);
    expect(r.ticketPromedio).toBe(1500);
    expect(r.topProductos[0].descripcion).toBe('Coca');
    expect(r.variacionPct).toBe(50);
    expect(r.medioPagoPredominante).toBe('efectivo');
  });

  it('formatearResumenSemanal debería ser rioplatense y legible', () => {
    const ventana = calcularVentanaSemanal(new Date('2024-11-10T12:00:00Z'));
    const r = calcularResumenSemanal(
      [venta('2024-11-05', 1000, [{ descripcion: 'A', cantidad: 1, subtotal: 1000 }])],
      [],
      ventana
    );
    const msg = formatearResumenSemanal(r, 'Kiosco Pepe');
    expect(msg).toContain('Kiosco Pepe');
    expect(msg).toContain('Total');
    expect(msg).toContain('Ticket promedio');
    expect(msg).toContain('Top productos');
  });
});
