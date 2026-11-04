/**
 * Repositorio de ventas e items
 */

import type { Venta, Item } from '../types.js';
import type { MemoryStore } from '../memoryStore.js';
import { query } from '../client.js';
import type { VentaExtracted } from '../../extraction/schema.js';

export type CrearVentaInput = {
  foto_id: string | null;
  comercio_id: string;
  extracted: VentaExtracted;
  requiere_revision: boolean;
};

export type VentaConItems = Venta & { items: Item[] };

export interface IVentaRepository {
  crear(input: CrearVentaInput): Promise<VentaConItems>;
  obtenerPorComercio(
    comercioId: string,
    desde?: string,
    hasta?: string
  ): Promise<VentaConItems[]>;
}

export class MemoryVentaRepository implements IVentaRepository {
  constructor(private store: MemoryStore) {}

  async crear(input: CrearVentaInput): Promise<VentaConItems> {
    const venta: Venta = {
      id: this.store.nuevoId(),
      foto_id: input.foto_id,
      comercio_id: input.comercio_id,
      fecha_venta: input.extracted.fecha,
      hora_venta: input.extracted.hora ?? null,
      total: input.extracted.total,
      medio_pago: input.extracted.medio_pago,
      confianza_score: input.extracted.confianza,
      requiere_revision: input.requiere_revision,
      revisada: false,
      datos_raw: input.extracted as unknown as Record<string, unknown>,
      creada_en: new Date(),
    };
    this.store.ventas.set(venta.id, venta);

    const items: Item[] = input.extracted.items.map((it, orden) => {
      const item: Item = {
        id: this.store.nuevoId(),
        venta_id: venta.id,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario ?? null,
        subtotal: it.subtotal,
        orden,
      };
      this.store.items.set(item.id, item);
      return item;
    });

    return { ...venta, items };
  }

  async obtenerPorComercio(
    comercioId: string,
    desde?: string,
    hasta?: string
  ): Promise<VentaConItems[]> {
    const ventas = [...this.store.ventas.values()].filter((v) => {
      if (v.comercio_id !== comercioId) return false;
      if (desde && v.fecha_venta < desde) return false;
      if (hasta && v.fecha_venta > hasta) return false;
      return true;
    });

    return ventas.map((v) => ({
      ...v,
      items: [...this.store.items.values()].filter((i) => i.venta_id === v.id),
    }));
  }
}

export class PostgresVentaRepository implements IVentaRepository {
  async crear(input: CrearVentaInput): Promise<VentaConItems> {
    const ventaResult = await query<Venta>(
      `INSERT INTO ventas (
         foto_id, comercio_id, fecha_venta, hora_venta, total, medio_pago,
         confianza_score, requiere_revision, datos_raw
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        input.foto_id,
        input.comercio_id,
        input.extracted.fecha,
        input.extracted.hora ?? null,
        input.extracted.total,
        input.extracted.medio_pago,
        input.extracted.confianza,
        input.requiere_revision,
        JSON.stringify(input.extracted),
      ]
    );

    const venta = mapVenta(ventaResult.rows[0]);
    const items: Item[] = [];

    for (let orden = 0; orden < input.extracted.items.length; orden++) {
      const it = input.extracted.items[orden];
      const itemResult = await query<Item>(
        `INSERT INTO items (venta_id, descripcion, cantidad, precio_unitario, subtotal, orden)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          venta.id,
          it.descripcion,
          it.cantidad,
          it.precio_unitario ?? null,
          it.subtotal,
          orden,
        ]
      );
      items.push(mapItem(itemResult.rows[0]));
    }

    return { ...venta, items };
  }

  async obtenerPorComercio(
    comercioId: string,
    desde?: string,
    hasta?: string
  ): Promise<VentaConItems[]> {
    const result = await query<Venta>(
      `SELECT * FROM ventas
       WHERE comercio_id = $1
         AND ($2::date IS NULL OR fecha_venta >= $2::date)
         AND ($3::date IS NULL OR fecha_venta <= $3::date)
       ORDER BY fecha_venta DESC`,
      [comercioId, desde ?? null, hasta ?? null]
    );

    const ventas: VentaConItems[] = [];
    for (const row of result.rows) {
      const venta = mapVenta(row);
      const itemsResult = await query<Item>(
        `SELECT * FROM items WHERE venta_id = $1 ORDER BY orden ASC`,
        [venta.id]
      );
      ventas.push({
        ...venta,
        items: itemsResult.rows.map(mapItem),
      });
    }
    return ventas;
  }
}

function mapVenta(row: Venta): Venta {
  return {
    ...row,
    total: Number(row.total),
    confianza_score:
      row.confianza_score === null ? null : Number(row.confianza_score),
    creada_en: new Date(row.creada_en),
    datos_raw:
      typeof row.datos_raw === 'string'
        ? (JSON.parse(row.datos_raw) as Record<string, unknown>)
        : row.datos_raw,
  };
}

function mapItem(row: Item): Item {
  return {
    ...row,
    cantidad: Number(row.cantidad),
    precio_unitario:
      row.precio_unitario === null ? null : Number(row.precio_unitario),
    subtotal: Number(row.subtotal),
  };
}
