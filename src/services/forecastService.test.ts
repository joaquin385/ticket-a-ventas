import { describe, it, expect } from 'vitest';
import {
  calcularPronosticoMensual,
  formatearPronostico,
  rangoHistoricoParaPronostico,
} from './forecastService.js';
import type { VentaConItems } from '../db/repositories/ventaRepository.js';

function venta(fecha: string, total: number): VentaConItems {
  return {
    id: `v-${fecha}`,
    foto_id: null,
    comercio_id: 'c1',
    fecha_venta: fecha,
    hora_venta: null,
    total,
    medio_pago: 'efectivo',
    confianza_score: 0.9,
    requiere_revision: false,
    revisada: false,
    datos_raw: null,
    creada_en: new Date(),
    items: [
      {
        id: `i-${fecha}`,
        venta_id: `v-${fecha}`,
        descripcion: 'Item',
        cantidad: 1,
        precio_unitario: total,
        subtotal: total,
        orden: 0,
      },
    ],
  };
}

describe('forecastService', () => {
  it('rangoHistoricoParaPronostico debería incluir mes actual y 3 meses atrás', () => {
    const r = rangoHistoricoParaPronostico(new Date('2024-11-15T12:00:00Z'));
    expect(r.mesDesde).toBe('2024-11-01');
    expect(r.mesHasta).toBe('2024-11-15');
    expect(r.desde).toBe('2024-08-01');
  });

  it('debería proyectar el mes con rango bajo/alto', () => {
    const ref = new Date('2024-11-10T12:00:00Z');
    const mes = [
      venta('2024-11-01', 1000),
      venta('2024-11-02', 1000),
      venta('2024-11-03', 1000),
      venta('2024-11-05', 1000),
      venta('2024-11-08', 1000),
    ];
    const hist = [
      venta('2024-10-07', 2000), // lunes
      venta('2024-10-14', 2000),
      venta('2024-09-07', 1500),
    ];

    const p = calcularPronosticoMensual(mes, hist, ref);
    expect(p.totalALaFecha).toBe(5000);
    expect(p.diasTranscurridos).toBe(10);
    expect(p.proyeccion).toBeGreaterThan(p.totalALaFecha);
    expect(p.rangoBajo).toBeLessThan(p.proyeccion);
    expect(p.rangoAlto).toBeGreaterThan(p.proyeccion);
    expect(p.diaPico).toBeTruthy();
  });

  it('formatearPronostico debería mencionar proyección y rango', () => {
    const p = calcularPronosticoMensual(
      [venta('2024-11-01', 5000)],
      [],
      new Date('2024-11-05T12:00:00Z')
    );
    const msg = formatearPronostico(p, 'Almacén Sur');
    expect(msg).toContain('Pronóstico');
    expect(msg).toContain('Almacén Sur');
    expect(msg).toContain('Proyección');
    expect(msg).toContain('Rango estimado');
  });
});
