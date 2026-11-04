/**
 * Job de resumen semanal (invocado por cron vía HTTP)
 */

import type { InsightsHandler } from '../services/insightsHandler.js';

export type ResumenSemanalJobResult = {
  ok: boolean;
  enviados: number;
  errores: number;
  comercioIds: string[];
  ejecutadoEn: string;
};

/**
 * Ejecuta el envío masivo del resumen (pensado para corridas los lunes)
 */
export async function ejecutarResumenSemanalJob(
  insights: InsightsHandler,
  cuando: Date = new Date()
): Promise<ResumenSemanalJobResult> {
  const result = await insights.enviarResumenSemanalATodos(cuando);
  return {
    ok: result.errores === 0,
    ...result,
    ejecutadoEn: cuando.toISOString(),
  };
}
