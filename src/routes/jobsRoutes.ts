/**
 * Endpoints protegidos para cron / jobs
 *
 * POST /api/jobs/resumen-semanal
 * Authorization: Bearer <JOBS_API_TOKEN>
 */

import type { Express, Request, Response } from 'express';
import { requireApiToken } from './exportRoutes.js';
import { ejecutarResumenSemanalJob } from '../jobs/resumenSemanal.js';
import type { InsightsHandler } from '../services/insightsHandler.js';

export type JobsRouteDeps = {
  insightsHandler: InsightsHandler;
  jobsApiToken: string | null;
};

export function registerJobsRoutes(app: Express, deps: JobsRouteDeps): void {
  const { insightsHandler, jobsApiToken } = deps;

  app.post(
    '/api/jobs/resumen-semanal',
    requireApiToken(jobsApiToken),
    async (req: Request, res: Response) => {
      try {
        const refRaw = req.body?.fecha ?? req.query.fecha;
        const cuando = refRaw ? new Date(String(refRaw)) : new Date();
        if (Number.isNaN(cuando.getTime())) {
          res.status(400).json({ error: 'fecha inválida (ISO 8601)' });
          return;
        }

        const result = await ejecutarResumenSemanalJob(
          insightsHandler,
          cuando
        );
        res.status(200).json(result);
      } catch (err) {
        console.error('Error en job resumen-semanal:', err);
        res.status(500).json({ error: 'Error ejecutando job' });
      }
    }
  );
}
