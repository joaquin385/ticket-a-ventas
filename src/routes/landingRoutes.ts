/**
 * Sirve la landing estática en /landing (M8)
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express, Request, Response } from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveLandingHtml(whatsappNumber: string): string {
  const candidates = [
    join(process.cwd(), 'landing/index.html'),
    join(__dirname, '../../landing/index.html'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      let html = readFileSync(p, 'utf-8');
      // Inyectar número configurable
      html = html.replace(
        /5491100000000/g,
        whatsappNumber.replace(/\D/g, '') || '5491100000000'
      );
      return html;
    }
  }
  return '<html><body><h1>Landing no encontrada</h1></body></html>';
}

export function registerLandingRoutes(
  app: Express,
  opts: { whatsappNumber: string }
): void {
  app.get(['/landing', '/landing/'], (_req: Request, res: Response) => {
    res.type('html').send(resolveLandingHtml(opts.whatsappNumber));
  });
}
