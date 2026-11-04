/**
 * Repositorio de suscripciones / billing
 */

import type { EstadoSuscripcion, Suscripcion } from '../types.js';
import type { MemoryStore } from '../memoryStore.js';
import { query } from '../client.js';

export type CrearSuscripcionInput = {
  comercio_id: string;
  plan?: string;
  precio_mensual: number;
  estado?: EstadoSuscripcion;
  fecha_inicio: string;
  fecha_fin_trial: string;
  limite_fotos_trial?: number;
  limite_fotos_mes?: number | null;
};

export interface ISuscripcionRepository {
  crear(input: CrearSuscripcionInput): Promise<Suscripcion>;
  obtenerPorComercio(comercioId: string): Promise<Suscripcion | null>;
  obtenerPorPreapprovalId(
    preapprovalId: string
  ): Promise<Suscripcion | null>;
  actualizar(
    id: string,
    patch: Partial<
      Pick<
        Suscripcion,
        | 'estado'
        | 'mercadopago_preapproval_id'
        | 'init_point'
        | 'fecha_proximo_cobro'
        | 'fotos_usadas_mes'
        | 'fotos_usadas_trial'
        | 'precio_mensual'
        | 'limite_fotos_mes'
      >
    >
  ): Promise<Suscripcion>;
}

function toYmd(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export class MemorySuscripcionRepository implements ISuscripcionRepository {
  constructor(private store: MemoryStore) {}

  async crear(input: CrearSuscripcionInput): Promise<Suscripcion> {
    const now = new Date();
    const sub: Suscripcion = {
      id: this.store.nuevoId(),
      comercio_id: input.comercio_id,
      plan: input.plan ?? 'basico',
      precio_mensual: input.precio_mensual,
      estado: input.estado ?? 'trial',
      mercadopago_preapproval_id: null,
      init_point: null,
      fecha_inicio: input.fecha_inicio,
      fecha_fin_trial: input.fecha_fin_trial,
      fecha_proximo_cobro: null,
      fotos_usadas_mes: 0,
      fotos_usadas_trial: 0,
      limite_fotos_mes: input.limite_fotos_mes ?? null,
      limite_fotos_trial: input.limite_fotos_trial ?? 30,
      creada_en: now,
      actualizada_en: now,
    };
    this.store.suscripciones.set(sub.id, sub);
    return { ...sub };
  }

  async obtenerPorComercio(comercioId: string): Promise<Suscripcion | null> {
    const found = [...this.store.suscripciones.values()].find(
      (s) => s.comercio_id === comercioId
    );
    return found ? { ...found } : null;
  }

  async obtenerPorPreapprovalId(
    preapprovalId: string
  ): Promise<Suscripcion | null> {
    const found = [...this.store.suscripciones.values()].find(
      (s) => s.mercadopago_preapproval_id === preapprovalId
    );
    return found ? { ...found } : null;
  }

  async actualizar(
    id: string,
    patch: Partial<Suscripcion>
  ): Promise<Suscripcion> {
    const sub = this.store.suscripciones.get(id);
    if (!sub) throw new Error(`Suscripción ${id} no encontrada`);
    Object.assign(sub, patch, { actualizada_en: new Date() });
    return { ...sub };
  }
}

export class PostgresSuscripcionRepository implements ISuscripcionRepository {
  async crear(input: CrearSuscripcionInput): Promise<Suscripcion> {
    const result = await query<Suscripcion>(
      `INSERT INTO suscripciones (
         comercio_id, plan, precio_mensual, estado, fecha_inicio, fecha_fin_trial,
         limite_fotos_trial, limite_fotos_mes, fotos_usadas_trial, fotos_usadas_mes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,0)
       RETURNING *`,
      [
        input.comercio_id,
        input.plan ?? 'basico',
        input.precio_mensual,
        input.estado ?? 'trial',
        input.fecha_inicio,
        input.fecha_fin_trial,
        input.limite_fotos_trial ?? 30,
        input.limite_fotos_mes ?? null,
      ]
    );
    return mapSuscripcion(result.rows[0]);
  }

  async obtenerPorComercio(comercioId: string): Promise<Suscripcion | null> {
    const result = await query<Suscripcion>(
      `SELECT * FROM suscripciones WHERE comercio_id = $1 ORDER BY creada_en DESC LIMIT 1`,
      [comercioId]
    );
    return result.rows[0] ? mapSuscripcion(result.rows[0]) : null;
  }

  async obtenerPorPreapprovalId(
    preapprovalId: string
  ): Promise<Suscripcion | null> {
    const result = await query<Suscripcion>(
      `SELECT * FROM suscripciones WHERE mercadopago_preapproval_id = $1 LIMIT 1`,
      [preapprovalId]
    );
    return result.rows[0] ? mapSuscripcion(result.rows[0]) : null;
  }

  async actualizar(
    id: string,
    patch: Partial<Suscripcion>
  ): Promise<Suscripcion> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const map: Array<[keyof Suscripcion, unknown]> = [
      ['estado', patch.estado],
      ['mercadopago_preapproval_id', patch.mercadopago_preapproval_id],
      ['init_point', patch.init_point],
      ['fecha_proximo_cobro', patch.fecha_proximo_cobro],
      ['fotos_usadas_mes', patch.fotos_usadas_mes],
      ['fotos_usadas_trial', patch.fotos_usadas_trial],
      ['precio_mensual', patch.precio_mensual],
      ['limite_fotos_mes', patch.limite_fotos_mes],
    ];

    for (const [key, val] of map) {
      if (val !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(val);
      }
    }

    fields.push(`actualizada_en = NOW()`);
    values.push(id);

    const result = await query<Suscripcion>(
      `UPDATE suscripciones SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!result.rows[0]) throw new Error(`Suscripción ${id} no encontrada`);
    return mapSuscripcion(result.rows[0]);
  }
}

function mapSuscripcion(row: Suscripcion): Suscripcion {
  return {
    ...row,
    precio_mensual: Number(row.precio_mensual),
    fotos_usadas_mes: Number(row.fotos_usadas_mes ?? 0),
    fotos_usadas_trial: Number(
      (row as Suscripcion).fotos_usadas_trial ?? 0
    ),
    limite_fotos_mes:
      row.limite_fotos_mes === null || row.limite_fotos_mes === undefined
        ? null
        : Number(row.limite_fotos_mes),
    limite_fotos_trial: Number(
      (row as Suscripcion).limite_fotos_trial ?? 30
    ),
    fecha_inicio:
      typeof row.fecha_inicio === 'string'
        ? row.fecha_inicio.slice(0, 10)
        : toYmd(new Date(row.fecha_inicio)),
    fecha_fin_trial: row.fecha_fin_trial
      ? String(row.fecha_fin_trial).slice(0, 10)
      : null,
    fecha_proximo_cobro: row.fecha_proximo_cobro
      ? String(row.fecha_proximo_cobro).slice(0, 10)
      : null,
    creada_en: new Date(row.creada_en),
    actualizada_en: new Date(row.actualizada_en),
  };
}
