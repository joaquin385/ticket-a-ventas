/**
 * Orquestación de exportación (WhatsApp + HTTP)
 */

import type { Repositories } from '../db/repositories/index.js';
import type { IWhatsAppSender } from '../whatsapp/sender.js';
import type { IDocumentSender } from '../whatsapp/documentSender.js';
import { parsearComando } from '../whatsapp/commands.js';
import { generarExport, type ArchivoExport } from './exportService.js';
import { formatearMontoARS } from './resumen.js';

export type ExportHandlerDeps = {
  repos: Repositories;
  sender: IWhatsAppSender;
  documentSender: IDocumentSender;
};

export type ExportResultado = {
  archivo: ArchivoExport;
  comercioId: string;
  desde: string;
  hasta: string;
};

export class ExportHandler {
  constructor(private deps: ExportHandlerDeps) {}

  /**
   * Genera export para un comercio y rango
   */
  async exportarPorComercio(
    comercioId: string,
    desde: string,
    hasta: string,
    formato: 'csv' | 'xlsx',
    etiqueta = 'export'
  ): Promise<ExportResultado> {
    const ventas = await this.deps.repos.ventas.obtenerPorComercio(
      comercioId,
      desde,
      hasta
    );
    const archivo = await generarExport(ventas, formato, etiqueta);
    return { archivo, comercioId, desde, hasta };
  }

  /**
   * Maneja texto WhatsApp: si es comando exportar, genera y envía el archivo
   * @returns true si se manejó un comando de export
   */
  async manejarTextoWhatsApp(
    telefono: string,
    texto: string
  ): Promise<boolean> {
    const comando = parsearComando(texto);
    if (comando.tipo !== 'exportar') {
      return false;
    }

    const { comercio } =
      await this.deps.repos.comercios.encontrarOCrearPorTelefono(telefono);

    const { archivo, desde, hasta } = await this.exportarPorComercio(
      comercio.id,
      comando.rango.desde,
      comando.rango.hasta,
      comando.formato,
      comando.rango.etiqueta
    );

    if (archivo.filas === 0) {
      await this.deps.sender.enviarMensaje(
        telefono,
        `No encontré ventas entre ${desde} y ${hasta}. Mandame una foto de un ticket para empezar.`
      );
      return true;
    }

    const caption = `📊 Export ${comando.rango.etiqueta} (${desde} → ${hasta}): ${archivo.totales.cantidadVentas} ventas, total ${formatearMontoARS(archivo.totales.totalARS)}`;

    await this.deps.documentSender.enviarDocumento({
      telefono,
      buffer: archivo.buffer,
      filename: archivo.filename,
      mimeType: archivo.mimeType.split(';')[0],
      caption,
    });

    await this.deps.sender.enviarMensaje(
      telefono,
      `Listo! Te mandé ${archivo.filename} con ${archivo.filas} filas.`
    );

    return true;
  }
}
