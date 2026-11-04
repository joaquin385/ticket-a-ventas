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

export type ComandoResumen = { tipo: 'resumen' };
export type ComandoPronostico = { tipo: 'pronostico' };

export type ComandoParseado =
  | ComandoExportar
  | ComandoResumen
  | ComandoPronostico
  | { tipo: 'desconocido' };

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizarTexto(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
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

  const desdeDate = new Date(ref);
  desdeDate.setUTCFullYear(desdeDate.getUTCFullYear() - 1);
  return { desde: toYmd(desdeDate), hasta, etiqueta: 'año' };
}

/**
 * Detecta comandos: exportar | resumen | pronostico/pronóstico
 */
export function parsearComando(
  texto: string,
  ref: Date = new Date()
): ComandoParseado {
  const normalizado = normalizarTexto(texto);

  if (
    normalizado === 'resumen' ||
    normalizado.startsWith('resumen ') ||
    normalizado === 'resumen semanal'
  ) {
    return { tipo: 'resumen' };
  }

  if (
    normalizado === 'pronostico' ||
    normalizado.startsWith('pronostico ') ||
    normalizado === 'forecast'
  ) {
    return { tipo: 'pronostico' };
  }

  if (!normalizado.startsWith('exportar')) {
    return { tipo: 'desconocido' };
  }

  const formato: FormatoExport = /\bcsv\b/.test(normalizado) ? 'csv' : 'xlsx';

  let periodo: 'hoy' | 'semana' | 'mes' | 'todo' = 'mes';
  if (/\bhoy\b|\bdia\b/.test(normalizado)) {
    periodo = 'hoy';
  } else if (/\bsemana\b/.test(normalizado)) {
    periodo = 'semana';
  } else if (
    /\bmes\b/.test(normalizado) ||
    normalizado === 'exportar' ||
    normalizado === 'exportar csv' ||
    normalizado === 'exportar excel' ||
    normalizado === 'exportar xlsx'
  ) {
    periodo = 'mes';
  } else if (/\bano\b|\btodo\b/.test(normalizado)) {
    periodo = 'todo';
  }

  return {
    tipo: 'exportar',
    rango: calcularRango(periodo, ref),
    formato,
  };
}
