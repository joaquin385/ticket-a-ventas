/**
 * Cola de revisión admin (ventas de baja confianza) — M7
 */

import type { Repositories } from '../db/repositories/index.js';
import type { IWhatsAppSender } from '../whatsapp/sender.js';
import type {
  ActualizarVentaInput,
  VentaConItems,
} from '../db/repositories/ventaRepository.js';
import { formatearMontoARS, formatearFecha } from './resumen.js';

export type VentaRevisionView = VentaConItems & {
  url_foto: string | null;
  telefono_whatsapp: string | null;
  nombre_comercio: string | null;
};

export type RevisionServiceDeps = {
  repos: Repositories;
  sender: IWhatsAppSender;
};

export class RevisionService {
  constructor(private deps: RevisionServiceDeps) {}

  async listarPendientes(limit = 50): Promise<VentaRevisionView[]> {
    const ventas = await this.deps.repos.ventas.listarPendientesRevision(limit);
    const out: VentaRevisionView[] = [];

    for (const v of ventas) {
      const comercio = await this.deps.repos.comercios.obtenerPorId(
        v.comercio_id
      );
      let url_foto: string | null = null;
      if (v.foto_id) {
        const foto = await this.deps.repos.fotos.obtenerPorId(v.foto_id);
        url_foto = foto?.url_foto ?? null;
      }
      out.push({
        ...v,
        url_foto,
        telefono_whatsapp: comercio?.telefono_whatsapp ?? null,
        nombre_comercio: comercio?.nombre ?? null,
      });
    }

    return out;
  }

  async editar(
    ventaId: string,
    input: ActualizarVentaInput
  ): Promise<VentaConItems> {
    return this.deps.repos.ventas.actualizar(ventaId, input);
  }

  async aprobar(ventaId: string): Promise<VentaRevisionView> {
    const venta = await this.deps.repos.ventas.marcarRevisada(ventaId);
    const comercio = await this.deps.repos.comercios.obtenerPorId(
      venta.comercio_id
    );

    let url_foto: string | null = null;
    if (venta.foto_id) {
      const foto = await this.deps.repos.fotos.obtenerPorId(venta.foto_id);
      url_foto = foto?.url_foto ?? null;
      if (foto) {
        await this.deps.repos.fotos.actualizarEstado(
          foto.id,
          'procesada',
          foto.url_foto
        );
      }
    }

    if (comercio?.telefono_whatsapp) {
      const msg = [
        '✅ Revisamos tu ticket y quedó confirmado:',
        `${formatearMontoARS(venta.total)} — ${venta.items.length} ítem(s) (${formatearFecha(venta.fecha_venta)})`,
        '',
        ...venta.items
          .slice(0, 8)
          .map(
            (i) =>
              `• ${i.descripcion} x${i.cantidad} = ${formatearMontoARS(i.subtotal)}`
          ),
      ].join('\n');
      await this.deps.sender.enviarMensaje(comercio.telefono_whatsapp, msg);
    }

    return {
      ...venta,
      url_foto,
      telefono_whatsapp: comercio?.telefono_whatsapp ?? null,
      nombre_comercio: comercio?.nombre ?? null,
    };
  }
}
