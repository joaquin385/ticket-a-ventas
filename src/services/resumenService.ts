/**
 * Resumen semanal de ventas por comercio
 */

import type { VentaConItems } from '../db/repositories/ventaRepository.js';
import { formatearMontoARS, formatearFecha } from './resumen.js';

export type TopProducto = {
  descripcion: string;
  cantidad: number;
  total: number;
};

export type ResumenSemanal = {
  desde: string;
  hasta: string;
  totalVendido: number;
  cantidadVentas: number;
  ticketPromedio: number;
  topProductos: TopProducto[];
  medioPagoPredominante: string | null;
  semanaAnterior: {
    desde: string;
    hasta: string;
    totalVendido: number;
    cantidadVentas: number;
  };
  /** Variación % vs semana anterior (null si no hay base) */
  variacionPct: number | null;
};

export type VentanaSemana = {
  desde: string;
  hasta: string;
  anteriorDesde: string;
  anteriorHasta: string;
};

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toYmd(d);
}

/**
 * Ventana de 7 días terminando en `ref` (inclusive), más la semana previa.
 * Para el job del lunes: pasar el domingo anterior como ref.
 */
export function calcularVentanaSemanal(ref: Date = new Date()): VentanaSemana {
  const hasta = toYmd(ref);
  const desde = addDays(hasta, -6);
  const anteriorHasta = addDays(desde, -1);
  const anteriorDesde = addDays(anteriorHasta, -6);
  return { desde, hasta, anteriorDesde, anteriorHasta };
}

/**
 * Semana calendario anterior (lun–dom) respecto a un lunes de envío.
 * Si `lunes` no es lunes UTC, se normaliza al lunes de esa semana ISO-ish (UTC).
 */
export function ventanaSemanaAnteriorParaLunes(lunes: Date = new Date()): VentanaSemana {
  const d = new Date(lunes);
  const day = d.getUTCDay(); // 0=dom … 1=lun
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offsetToMonday);
  // Domingo anterior = lunes - 1
  const hastaDate = new Date(d);
  hastaDate.setUTCDate(hastaDate.getUTCDate() - 1);
  return calcularVentanaSemanal(hastaDate);
}

export function calcularResumenSemanal(
  ventasSemana: VentaConItems[],
  ventasAnterior: VentaConItems[],
  ventana: VentanaSemana
): ResumenSemanal {
  const totalVendido = ventasSemana.reduce((a, v) => a + v.total, 0);
  const cantidadVentas = ventasSemana.length;
  const ticketPromedio =
    cantidadVentas === 0 ? 0 : totalVendido / cantidadVentas;

  const productoMap = new Map<string, TopProducto>();
  const medios = new Map<string, number>();

  for (const venta of ventasSemana) {
    const medio = venta.medio_pago ?? 'sin especificar';
    medios.set(medio, (medios.get(medio) ?? 0) + venta.total);

    for (const item of venta.items) {
      const key = item.descripcion.trim().toLowerCase();
      const prev = productoMap.get(key);
      if (prev) {
        prev.cantidad += item.cantidad;
        prev.total += item.subtotal;
      } else {
        productoMap.set(key, {
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          total: item.subtotal,
        });
      }
    }
  }

  const topProductos = [...productoMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  let medioPagoPredominante: string | null = null;
  let maxMedio = -1;
  for (const [medio, monto] of medios) {
    if (monto > maxMedio) {
      maxMedio = monto;
      medioPagoPredominante = medio;
    }
  }

  const totalAnterior = ventasAnterior.reduce((a, v) => a + v.total, 0);
  const cantidadAnterior = ventasAnterior.length;

  let variacionPct: number | null = null;
  if (totalAnterior > 0) {
    variacionPct = ((totalVendido - totalAnterior) / totalAnterior) * 100;
  } else if (totalVendido > 0) {
    variacionPct = null; // sin base comparable
  }

  return {
    desde: ventana.desde,
    hasta: ventana.hasta,
    totalVendido,
    cantidadVentas,
    ticketPromedio,
    topProductos,
    medioPagoPredominante,
    semanaAnterior: {
      desde: ventana.anteriorDesde,
      hasta: ventana.anteriorHasta,
      totalVendido: totalAnterior,
      cantidadVentas: cantidadAnterior,
    },
    variacionPct,
  };
}

/**
 * Mensaje WhatsApp en español rioplatense
 */
export function formatearResumenSemanal(
  resumen: ResumenSemanal,
  nombreComercio?: string
): string {
  const header = nombreComercio
    ? `📊 Resumen semanal — ${nombreComercio}`
    : '📊 Resumen semanal';

  const lineas: string[] = [
    header,
    `${formatearFecha(resumen.desde)} → ${formatearFecha(resumen.hasta)}`,
    '',
    `💰 Total: ${formatearMontoARS(resumen.totalVendido)}`,
    `🧾 Ventas: ${resumen.cantidadVentas}`,
    `🎫 Ticket promedio: ${formatearMontoARS(resumen.ticketPromedio)}`,
  ];

  if (resumen.medioPagoPredominante) {
    lineas.push(`💳 Medio de pago más usado: ${resumen.medioPagoPredominante}`);
  }

  if (resumen.variacionPct !== null) {
    const signo = resumen.variacionPct >= 0 ? '+' : '';
    const emoji = resumen.variacionPct >= 0 ? '📈' : '📉';
    lineas.push(
      `${emoji} Vs semana anterior: ${signo}${resumen.variacionPct.toFixed(0)}% (${formatearMontoARS(resumen.semanaAnterior.totalVendido)})`
    );
  } else if (resumen.semanaAnterior.totalVendido === 0 && resumen.totalVendido > 0) {
    lineas.push('📈 Vs semana anterior: sin ventas previas para comparar');
  } else {
    lineas.push(
      `📭 Semana anterior: ${formatearMontoARS(resumen.semanaAnterior.totalVendido)}`
    );
  }

  if (resumen.topProductos.length > 0) {
    lineas.push('', '🏆 Top productos:');
    resumen.topProductos.forEach((p, i) => {
      lineas.push(
        `${i + 1}. ${p.descripcion} — ${formatearMontoARS(p.total)} (x${p.cantidad})`
      );
    });
  } else {
    lineas.push('', 'No registraste ventas esta semana.');
  }

  return lineas.join('\n');
}
