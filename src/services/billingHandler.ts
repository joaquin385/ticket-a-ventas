/**
 * Comandos WhatsApp de billing: suscribirme, pagar, estado, mi plan
 */

import type { Repositories } from '../db/repositories/index.js';
import type { IWhatsAppSender } from '../whatsapp/sender.js';
import { SuscripcionService } from './suscripcionService.js';
import { formatearMontoARS } from './resumen.js';

export type BillingHandlerDeps = {
  repos: Repositories;
  sender: IWhatsAppSender;
  suscripciones: SuscripcionService;
  precioMensualArs: number;
};

export class BillingHandler {
  constructor(private deps: BillingHandlerDeps) {}

  async manejarSuscribirme(telefono: string): Promise<void> {
    const { comercio } =
      await this.deps.repos.comercios.encontrarOCrearPorTelefono(telefono);
    const { initPoint } = await this.deps.suscripciones.obtenerLinkPago(
      comercio.id,
      comercio.email ?? undefined
    );
    const precio = formatearMontoARS(this.deps.precioMensualArs);
    await this.deps.sender.enviarMensaje(
      telefono,
      `💳 Suscripción Ticket a Ventas — ${precio}/mes\n\nPagá acá (Mercado Pago):\n${initPoint}\n\nCuando se acredite, tu plan queda activo solo.`
    );
  }

  async manejarEstado(telefono: string): Promise<void> {
    const { comercio } =
      await this.deps.repos.comercios.encontrarOCrearPorTelefono(telefono);
    const sub = await this.deps.suscripciones.asegurarTrial(comercio.id);
    const msg = this.deps.suscripciones.mensajeEstado(sub);
    await this.deps.sender.enviarMensaje(telefono, msg);
  }
}
