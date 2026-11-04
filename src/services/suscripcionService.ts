/**
 * Lógica de trial, límites y suscripción Mercado Pago
 */

import type { Repositories } from '../db/repositories/index.js';
import type { IMercadoPagoClient } from '../mercadopago/client.js';
import type { EstadoSuscripcion, Suscripcion } from '../db/types.js';
import { formatearMontoARS } from './resumen.js';

export type BillingConfig = {
  precioMensualArs: number;
  trialDias: number;
  trialFotos: number;
  baseUrl: string;
};

export type AccesoResultado =
  | { permitido: true; suscripcion: Suscripcion; motivo: 'trial' | 'activa' }
  | {
      permitido: false;
      suscripcion: Suscripcion;
      motivo: 'trial_vencido' | 'sin_suscripcion' | 'pausada' | 'cancelada' | 'en_mora';
      initPoint: string | null;
    };

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toYmd(d);
}

export function trialVigente(
  sub: Suscripcion,
  ahora: Date = new Date()
): boolean {
  if (sub.estado !== 'trial') return false;
  const hoy = toYmd(ahora);
  if (sub.fecha_fin_trial && hoy > sub.fecha_fin_trial) return false;
  if (sub.fotos_usadas_trial >= sub.limite_fotos_trial) return false;
  return true;
}

export function mapearEstadoMp(status: string): EstadoSuscripcion | null {
  const s = status.toLowerCase();
  if (s === 'authorized' || s === 'active') return 'activa';
  if (s === 'paused') return 'pausada';
  if (s === 'cancelled' || s === 'canceled') return 'cancelada';
  // pagos fallidos / overdue
  if (s === 'pending' || s === 'charged_back') return null;
  return null;
}

export class SuscripcionService {
  constructor(
    private repos: Repositories,
    private mp: IMercadoPagoClient,
    private billing: BillingConfig
  ) {}

  /**
   * Obtiene o crea trial para el comercio
   */
  async asegurarTrial(
    comercioId: string,
    ahora: Date = new Date()
  ): Promise<Suscripcion> {
    const existing = await this.repos.suscripciones.obtenerPorComercio(
      comercioId
    );
    if (existing) return existing;

    const inicio = toYmd(ahora);
    return this.repos.suscripciones.crear({
      comercio_id: comercioId,
      plan: 'basico',
      precio_mensual: this.billing.precioMensualArs,
      estado: 'trial',
      fecha_inicio: inicio,
      fecha_fin_trial: addDays(inicio, this.billing.trialDias),
      limite_fotos_trial: this.billing.trialFotos,
      limite_fotos_mes: null,
    });
  }

  /**
   * Evalúa si puede procesar fotos
   */
  async evaluarAcceso(
    comercioId: string,
    ahora: Date = new Date()
  ): Promise<AccesoResultado> {
    const sub = await this.asegurarTrial(comercioId, ahora);

    if (sub.estado === 'activa') {
      return { permitido: true, suscripcion: sub, motivo: 'activa' };
    }

    if (sub.estado === 'trial' && trialVigente(sub, ahora)) {
      return { permitido: true, suscripcion: sub, motivo: 'trial' };
    }

    if (sub.estado === 'pausada') {
      return {
        permitido: false,
        suscripcion: sub,
        motivo: 'pausada',
        initPoint: sub.init_point,
      };
    }
    if (sub.estado === 'cancelada') {
      return {
        permitido: false,
        suscripcion: sub,
        motivo: 'cancelada',
        initPoint: sub.init_point,
      };
    }
    if (sub.estado === 'en_mora') {
      return {
        permitido: false,
        suscripcion: sub,
        motivo: 'en_mora',
        initPoint: sub.init_point,
      };
    }

    // trial vencido (días o fotos)
    return {
      permitido: false,
      suscripcion: sub,
      motivo: 'trial_vencido',
      initPoint: sub.init_point,
    };
  }

  /**
   * Crea o reutiliza preapproval y guarda init_point
   */
  async obtenerLinkPago(
    comercioId: string,
    email?: string
  ): Promise<{ suscripcion: Suscripcion; initPoint: string }> {
    let sub = await this.asegurarTrial(comercioId);

    if (sub.init_point && sub.mercadopago_preapproval_id) {
      return { suscripcion: sub, initPoint: sub.init_point };
    }

    const preapproval = await this.mp.crearPreapproval({
      reason: 'Ticket a Ventas — plan mensual',
      externalReference: comercioId,
      payerEmail: email,
      transactionAmount: this.billing.precioMensualArs,
      backUrl: `${this.billing.baseUrl}/billing/retorno`,
    });

    sub = await this.repos.suscripciones.actualizar(sub.id, {
      mercadopago_preapproval_id: preapproval.id,
      init_point: preapproval.initPoint,
    });

    return { suscripcion: sub, initPoint: preapproval.initPoint };
  }

  async registrarFotoUsada(comercioId: string): Promise<Suscripcion> {
    const sub = await this.asegurarTrial(comercioId);
    if (sub.estado === 'trial') {
      return this.repos.suscripciones.actualizar(sub.id, {
        fotos_usadas_trial: sub.fotos_usadas_trial + 1,
        fotos_usadas_mes: sub.fotos_usadas_mes + 1,
      });
    }
    return this.repos.suscripciones.actualizar(sub.id, {
      fotos_usadas_mes: sub.fotos_usadas_mes + 1,
    });
  }

  /**
   * Actualiza estado desde webhook / consulta MP
   */
  async aplicarEstadoDesdeMp(
    preapprovalId: string,
    statusMp: string
  ): Promise<Suscripcion | null> {
    const sub =
      await this.repos.suscripciones.obtenerPorPreapprovalId(preapprovalId);
    if (!sub) return null;

    const mapped = mapearEstadoMp(statusMp);
    if (!mapped) {
      // pending u otros: si estábamos en trial vencido, marcar en_mora si había cobro fallido
      if (statusMp.toLowerCase() === 'pending' && sub.estado === 'activa') {
        return this.repos.suscripciones.actualizar(sub.id, {
          estado: 'en_mora',
        });
      }
      return sub;
    }

    const patch: Partial<Suscripcion> = { estado: mapped };
    if (mapped === 'activa') {
      patch.fotos_usadas_mes = 0;
    }
    return this.repos.suscripciones.actualizar(sub.id, patch);
  }

  mensajeBloqueo(acceso: Extract<AccesoResultado, { permitido: false }>): string {
    const precio = formatearMontoARS(this.billing.precioMensualArs);
    const link = acceso.initPoint
      ? `\n\nPara seguir: ${acceso.initPoint}`
      : '\n\nEscribí *suscribirme* y te mando el link de pago.';

    switch (acceso.motivo) {
      case 'trial_vencido':
        return (
          `⏰ Se terminó tu prueba gratis (14 días o ${this.billing.trialFotos} fotos).\n` +
          `El plan sale ${precio}/mes. ¡Seguimos digitalizando tus ventas!` +
          link
        );
      case 'pausada':
        return (
          `⏸️ Tu suscripción está pausada. Reactivala para seguir mandando tickets.` +
          link
        );
      case 'cancelada':
        return (
          `❌ Tu suscripción está cancelada. Suscribite de nuevo cuando quieras.` +
          link
        );
      case 'en_mora':
        return (
          `⚠️ Hay un problema con el cobro de tu plan (${precio}/mes). Actualizá el pago para seguir.` +
          link
        );
      default:
        return `Para usar Ticket a Ventas necesitás un plan activo (${precio}/mes).` + link;
    }
  }

  mensajeEstado(sub: Suscripcion, ahora: Date = new Date()): string {
    const precio = formatearMontoARS(sub.precio_mensual);
    if (sub.estado === 'trial') {
      const vigente = trialVigente(sub, ahora);
      const fotosRestantes = Math.max(
        0,
        sub.limite_fotos_trial - sub.fotos_usadas_trial
      );
      return [
        '📋 Tu plan: *Prueba gratis*',
        vigente
          ? `Válida hasta ${sub.fecha_fin_trial} o ${fotosRestantes} fotos restantes.`
          : 'La prueba ya venció.',
        `Fotos usadas: ${sub.fotos_usadas_trial}/${sub.limite_fotos_trial}`,
        `Plan de pago: ${precio}/mes — escribí *suscribirme* cuando quieras.`,
      ].join('\n');
    }

    const labels: Record<EstadoSuscripcion, string> = {
      trial: 'Prueba',
      activa: 'Activa ✅',
      pausada: 'Pausada ⏸️',
      cancelada: 'Cancelada',
      en_mora: 'En mora ⚠️',
    };

    return [
      `📋 Tu plan: *${sub.plan}* — ${labels[sub.estado]}`,
      `Precio: ${precio}/mes`,
      sub.fecha_proximo_cobro
        ? `Próximo cobro: ${sub.fecha_proximo_cobro}`
        : null,
      sub.init_point && sub.estado !== 'activa'
        ? `Link de pago: ${sub.init_point}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
