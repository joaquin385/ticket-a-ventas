/**
 * Orquestación M3: foto → storage → extracción → persistencia → reply WhatsApp
 */

import type { IExtractor } from '../extraction/extractor.js';
import { bufferToDataUrl } from '../extraction/extractor.js';
import { requiereRevision } from '../extraction/schema.js';
import type { Repositories } from '../db/repositories/index.js';
import type { IStorage } from '../storage/storage.js';
import type { IWhatsAppSender } from '../whatsapp/sender.js';
import type { ImagenRecibida } from '../whatsapp/webhook.js';
import {
  resumenPendienteRevision,
  resumenVentaRegistrada,
} from './resumen.js';
import type { VentaConItems } from '../db/repositories/ventaRepository.js';

export type VentaServiceDeps = {
  repos: Repositories;
  storage: IStorage;
  extractor: IExtractor;
  sender: IWhatsAppSender;
  minConfidence?: number;
};

export type ProcesarImagenResult = {
  venta: VentaConItems;
  mensaje: string;
  bajaConfianza: boolean;
};

export class VentaService {
  constructor(private deps: VentaServiceDeps) {}

  /**
   * Pipeline completo al recibir una imagen por WhatsApp
   */
  async procesarImagen(imagen: ImagenRecibida): Promise<ProcesarImagenResult> {
    const { repos, storage, extractor, sender } = this.deps;

    const { comercio, usuario } =
      await repos.comercios.encontrarOCrearPorTelefono(imagen.from);

    const foto = await repos.fotos.guardar({
      comercio_id: comercio.id,
      usuario_id: usuario.id,
      whatsapp_media_id: imagen.mediaId,
      estado: 'pendiente',
      metadata: {
        message_id: imagen.messageId,
        mime_type: imagen.mimeType,
      },
    });

    const key = `comercios/${comercio.id}/fotos/${foto.id}.jpg`;
    const uploaded = await storage.upload({
      key,
      body: imagen.buffer,
      contentType: imagen.mimeType || 'image/jpeg',
    });

    await repos.fotos.actualizarEstado(foto.id, 'pendiente', uploaded.url);

    const dataUrl = bufferToDataUrl(imagen.buffer, imagen.mimeType);
    const extracted = await extractor.extract(dataUrl);
    const bajaConfianza = requiereRevision(extracted);

    const venta = await repos.ventas.crear({
      foto_id: foto.id,
      comercio_id: comercio.id,
      extracted,
      requiere_revision: bajaConfianza,
    });

    await repos.fotos.actualizarEstado(
      foto.id,
      bajaConfianza ? 'revision' : 'procesada',
      uploaded.url
    );

    const mensaje = bajaConfianza
      ? resumenPendienteRevision()
      : resumenVentaRegistrada(extracted);

    await sender.enviarMensaje(imagen.from, mensaje);

    return { venta, mensaje, bajaConfianza };
  }
}
