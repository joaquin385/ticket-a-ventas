/**
 * Endpoint HTTP autenticado para exportar ventas
 *
 * GET /api/export?comercio_id=&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&formato=xlsx|csv
 * Authorization: Bearer <EXPORT_API_TOKEN>
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { ExportHandler } from '../services/exportHandler.js';

export type ExportRouteDeps = {
  exportHandler: ExportHandler;
  apiToken: string | null;
};

function unauthorized(res: Response): void {
  res.status(401).json({ error: 'No autorizado. Usá Bearer EXPORT_API_TOKEN.' });
}

/**
 * Middleware Bearer token
 */
export function requireApiToken(apiToken: string | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!apiToken) {
      // Sin token configurado: rechazar en HTTP (evita export abierto)
      unauthorized(res);
      return;
    }

    const header = req.header('authorization') ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match || match[1] !== apiToken) {
      unauthorized(res);
      return;
    }
    next();
  };
}

export function registerExportRoutes(
  app: Express,
  deps: ExportRouteDeps
): void {
  const { exportHandler, apiToken } = deps;

  app.get(
    '/api/export',
    requireApiToken(apiToken),
    async (req: Request, res: Response) => {
      try {
        const comercioId = String(req.query.comercio_id ?? '');
        const desde = String(req.query.desde ?? '');
        const hasta = String(req.query.hasta ?? '');
        const formatoRaw = String(req.query.formato ?? 'xlsx').toLowerCase();
        const formato = formatoRaw === 'csv' ? 'csv' : 'xlsx';

        if (!comercioId || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
          res.status(400).json({
            error:
              'Parámetros requeridos: comercio_id, desde (YYYY-MM-DD), hasta (YYYY-MM-DD). Opcional: formato=xlsx|csv',
          });
          return;
        }

        const { archivo } = await exportHandler.exportarPorComercio(
          comercioId,
          desde,
          hasta,
          formato,
          'api'
        );

        res.setHeader('Content-Type', archivo.mimeType);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${archivo.filename}"`
        );
        res.setHeader('X-Export-Rows', String(archivo.filas));
        res.setHeader(
          'X-Export-Total-ARS',
          String(archivo.totales.totalARS)
        );
        res.status(200).send(archivo.buffer);
      } catch (err) {
        console.error('Error en /api/export:', err);
        res.status(500).json({ error: 'Error generando export' });
      }
    }
  );
}
