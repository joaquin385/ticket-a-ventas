/**
 * Pronóstico mensual simple basado en ventas a la fecha + promedio por día de semana
 */

import type { VentaConItems } from '../db/repositories/ventaRepository.js';
import { formatearMontoARS } from './resumen.js';

const DIAS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

export type PronosticoMensual = {
  anio: number;
  mes: number; // 1-12
  diasDelMes: number;
  diasTranscurridos: number;
  diasRestantes: number;
  totalALaFecha: number;
  cantidadVentasALaFecha: number;
  promedioDiario: number;
  /** Promedio histórico por día de semana (0=dom … 6=sáb) */
  promedioPorDiaSemana: number[];
  proyeccion: number;
  rangoBajo: number;
  rangoAlto: number;
  diaPico: string | null;
};

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/**
 * Calcula proyección del mes calendario de `ref`
 *
 * Método:
 * 1. Suma ventas del mes hasta hoy
 * 2. Promedio diario = total / días con datos (o días transcurridos)
 * 3. Para días restantes: usa promedio del mismo día de semana si hay historial,
 *    si no el promedio diario general
 * 4. Rango: ±20% (o ±30% si hay pocos datos)
 */
export function calcularPronosticoMensual(
  ventasMesActual: VentaConItems[],
  ventasHistoricas: VentaConItems[],
  ref: Date = new Date()
): PronosticoMensual {
  const anio = ref.getUTCFullYear();
  const mes = ref.getUTCMonth() + 1;
  const diasDelMes = daysInMonth(anio, mes);
  const diasTranscurridos = Math.min(ref.getUTCDate(), diasDelMes);
  const diasRestantes = Math.max(0, diasDelMes - diasTranscurridos);

  const totalALaFecha = ventasMesActual.reduce((a, v) => a + v.total, 0);
  const cantidadVentasALaFecha = ventasMesActual.length;

  // Días con al menos una venta en el mes actual
  const diasConVenta = new Set(ventasMesActual.map((v) => v.fecha_venta));
  const divisor = Math.max(diasConVenta.size, 1);
  const promedioDiario = totalALaFecha / divisor;

  // Promedio por día de semana con histórico (mes actual + histórico)
  const sumas = Array(7).fill(0) as number[];
  const counts = Array(7).fill(0) as number[];
  const porFecha = new Map<string, number>();

  for (const v of [...ventasHistoricas, ...ventasMesActual]) {
    porFecha.set(v.fecha_venta, (porFecha.get(v.fecha_venta) ?? 0) + v.total);
  }

  for (const [fecha, total] of porFecha) {
    const dow = new Date(`${fecha}T00:00:00.000Z`).getUTCDay();
    sumas[dow] += total;
    counts[dow] += 1;
  }

  const promedioPorDiaSemana = sumas.map((s, i) =>
    counts[i] > 0 ? s / counts[i] : promedioDiario
  );

  let proyeccionRestante = 0;
  const cursor = new Date(Date.UTC(anio, mes - 1, diasTranscurridos + 1));
  for (let i = 0; i < diasRestantes; i++) {
    const dow = cursor.getUTCDay();
    const base =
      counts[dow] > 0 ? promedioPorDiaSemana[dow] : promedioDiario;
    proyeccionRestante += base;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const proyeccion = totalALaFecha + proyeccionRestante;
  const margen = cantidadVentasALaFecha < 5 ? 0.3 : 0.2;
  const rangoBajo = Math.max(0, proyeccion * (1 - margen));
  const rangoAlto = proyeccion * (1 + margen);

  let diaPico: string | null = null;
  let maxAvg = -1;
  for (let i = 0; i < 7; i++) {
    if (counts[i] > 0 && promedioPorDiaSemana[i] > maxAvg) {
      maxAvg = promedioPorDiaSemana[i];
      diaPico = DIAS[i];
    }
  }

  return {
    anio,
    mes,
    diasDelMes,
    diasTranscurridos,
    diasRestantes,
    totalALaFecha,
    cantidadVentasALaFecha,
    promedioDiario,
    promedioPorDiaSemana,
    proyeccion,
    rangoBajo,
    rangoAlto,
    diaPico,
  };
}

export function rangoHistoricoParaPronostico(ref: Date = new Date()): {
  desde: string;
  hasta: string;
  mesDesde: string;
  mesHasta: string;
} {
  const anio = ref.getUTCFullYear();
  const mes = ref.getUTCMonth() + 1;
  const mesDesde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const mesHasta = toYmd(ref);

  // 3 meses atrás para patrones por día de semana
  const hist = new Date(Date.UTC(anio, mes - 1 - 3, 1));
  return {
    desde: toYmd(hist),
    hasta: mesHasta,
    mesDesde,
    mesHasta,
  };
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Mensaje WhatsApp rioplatense
 */
export function formatearPronostico(
  p: PronosticoMensual,
  nombreComercio?: string
): string {
  const nombreMes = MESES[p.mes - 1];
  const header = nombreComercio
    ? `🔮 Pronóstico — ${nombreComercio}`
    : `🔮 Pronóstico de ${nombreMes}`;

  const lineas = [
    header,
    `Mes: ${nombreMes} ${p.anio} (día ${p.diasTranscurridos}/${p.diasDelMes})`,
    '',
    `💰 Vendiste hasta ahora: ${formatearMontoARS(p.totalALaFecha)} (${p.cantidadVentasALaFecha} ventas)`,
    `📅 Promedio diario: ${formatearMontoARS(p.promedioDiario)}`,
    `🎯 Proyección del mes: ${formatearMontoARS(p.proyeccion)}`,
    `📉 Rango estimado: ${formatearMontoARS(p.rangoBajo)} – ${formatearMontoARS(p.rangoAlto)}`,
  ];

  if (p.diaPico) {
    lineas.push(`⭐ Suele ser tu mejor día: ${p.diaPico}`);
  }

  if (p.cantidadVentasALaFecha === 0) {
    lineas.push(
      '',
      'Todavía no hay ventas este mes: el pronóstico va a afinar cuando cargues tickets.'
    );
  } else if (p.cantidadVentasALaFecha < 5) {
    lineas.push(
      '',
      'Con pocas ventas el rango es más amplio. Seguí mandando fotos y se afila solo.'
    );
  }

  return lineas.join('\n');
}
