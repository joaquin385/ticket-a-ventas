/**
 * Parser de comandos de texto por WhatsApp
 */

export type RangoExport = {
  desde: string; // YYYY-MM-DD
  hasta: string;
  etiqueta: string;
};

export type FormatoExport = 'csv' | 'xlsx';

export type ComandoExportar = {
  tipo: 'exportar';
  rango: RangoExport;
  formato: FormatoExport;
};

export type ComandoParseado = ComandoExportar | { tipo: 'desconocido' };

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula rangos relativos a una fecha de referencia (default: hoy UTC)
 */
export function calcularRango(
  periodo: 'hoy' | 'semana' | 'mes' | 'todo',
  ref: Date = new Date()
): RangoExport {
  const hasta = toYmd(ref);

  if (periodo === 'hoy') {
    return { desde: hasta, hasta, etiqueta: 'hoy' };
  }

  if (periodo === 'semana') {
    const desdeDate = new Date(ref);
    desdeDate.setUTCDate(desdeDate.getUTCDate() - 6);
    return { desde: toYmd(desdeDate), hasta, etiqueta: 'semana' };
  }

  if (periodo === 'mes') {
    const desde = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, '0')}-01`;
    return { desde, hasta, etiqueta: 'mes' };
  }

  // todo: últimos 365 días
  const desdeDate = new Date(ref);
  desdeDate.setUTCFullYear(desdeDate.getUTCFullYear() - 1);
  return { desde: toYmd(desdeDate), hasta, etiqueta: 'año' };
}

/**
 * Detecta comandos de exportación en texto libre
 *
 * Ejemplos: "exportar", "exportar mes", "exportar semana csv", "EXPORTAR MES"
 */
export function parsearComando(
  texto: string,
  ref: Date = new Date()
): ComandoParseado {
  const normalizado = texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  if (!normalizado.startsWith('exportar')) {
    return { tipo: 'desconocido' };
  }

  const formato: FormatoExport = /\bcsv\b/.test(normalizado) ? 'csv' : 'xlsx';

  let periodo: 'hoy' | 'semana' | 'mes' | 'todo' = 'mes';
  if (/\bhoy\b|\bdia\b|\bdía\b/.test(texto.toLowerCase()) || /\bdia\b/.test(normalizado)) {
    periodo = 'hoy';
  } else if (/\bsemana\b/.test(normalizado)) {
    periodo = 'semana';
  } else if (/\bmes\b/.test(normalizado) || normalizado === 'exportar' || normalizado === 'exportar csv' || normalizado === 'exportar excel' || normalizado === 'exportar xlsx') {
    periodo = 'mes';
  } else if (/\ba[nñ]o\b|\btodo\b/.test(normalizado)) {
    periodo = 'todo';
  }

  return {
    tipo: 'exportar',
    rango: calcularRango(periodo, ref),
    formato,
  };
}
