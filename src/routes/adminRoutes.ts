/**
 * Admin API + página de cola de revisión (M7)
 *
 * GET  /admin                     → HTML
 * GET  /admin/api/ventas/revision → lista (Bearer ADMIN_API_TOKEN)
 * PUT  /admin/api/ventas/:id
 * POST /admin/api/ventas/:id/aprobar
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express, Request, Response } from 'express';
import { requireApiToken } from './exportRoutes.js';
import type { RevisionService } from '../services/revisionService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type AdminRouteDeps = {
  revisionService: RevisionService;
  adminApiToken: string | null;
};

function resolveAdminHtml(): string {
  const candidates = [
    join(process.cwd(), 'public/admin/index.html'),
    join(__dirname, '../../public/admin/index.html'),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, 'utf-8');
    } catch {
      // try next
    }
  }
  return '<html><body><h1>Admin HTML no encontrado</h1></body></html>';
}

export function registerAdminRoutes(app: Express, deps: AdminRouteDeps): void {
  const { revisionService, adminApiToken } = deps;
  const auth = requireApiToken(adminApiToken);

  app.get('/admin', (_req: Request, res: Response) => {
    res.type('html').send(resolveAdminHtml());
  });

  app.get(
    '/admin/api/ventas/revision',
    auth,
    async (_req: Request, res: Response) => {
      try {
        const list = await revisionService.listarPendientes();
        res.json(list);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error listando revisiones' });
      }
    }
  );

  app.put(
    '/admin/api/ventas/:id',
    auth,
    async (req: Request, res: Response) => {
      try {
        const updated = await revisionService.editar(String(req.params.id), {
          total:
            req.body?.total !== undefined ? Number(req.body.total) : undefined,
          fecha_venta: req.body?.fecha_venta,
          hora_venta: req.body?.hora_venta,
          medio_pago: req.body?.medio_pago,
          items: req.body?.items,
        });
        res.json(updated);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error actualizando venta' });
      }
    }
  );

  app.post(
    '/admin/api/ventas/:id/aprobar',
    auth,
    async (req: Request, res: Response) => {
      try {
        const approved = await revisionService.aprobar(String(req.params.id));
        res.json(approved);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error aprobando venta' });
      }
    }
  );
}
