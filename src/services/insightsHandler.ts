/**
 * Comandos WhatsApp: resumen y pronóstico
 */

import type { Repositories } from '../db/repositories/index.js';
import type { IWhatsAppSender } from '../whatsapp/sender.js';
import {
  calcularResumenSemanal,
  calcularVentanaSemanal,
  formatearResumenSemanal,
  ventanaSemanaAnteriorParaLunes,
  type ResumenSemanal,
} from './resumenService.js';
import {
  calcularPronosticoMensual,
  formatearPronostico,
  rangoHistoricoParaPronostico,
  type PronosticoMensual,
} from './forecastService.js';
import type { Comercio } from '../db/types.js';

export type InsightsHandlerDeps = {
  repos: Repositories;
  sender: IWhatsAppSender;
};

export class InsightsHandler {
  constructor(private deps: InsightsHandlerDeps) {}

  async armarResumen(
    comercio: Comercio,
    ref: Date = new Date()
  ): Promise<{ resumen: ResumenSemanal; mensaje: string }> {
    const ventana = calcularVentanaSemanal(ref);
    const [ventas, anteriores] = await Promise.all([
      this.deps.repos.ventas.obtenerPorComercio(
        comercio.id,
        ventana.desde,
        ventana.hasta
      ),
      this.deps.repos.ventas.obtenerPorComercio(
        comercio.id,
        ventana.anteriorDesde,
        ventana.anteriorHasta
      ),
    ]);

    const resumen = calcularResumenSemanal(ventas, anteriores, ventana);
    const mensaje = formatearResumenSemanal(resumen, comercio.nombre);
    return { resumen, mensaje };
  }

  async armarPronostico(
    comercio: Comercio,
    ref: Date = new Date()
  ): Promise<{ pronostico: PronosticoMensual; mensaje: string }> {
    const rango = rangoHistoricoParaPronostico(ref);
    const [ventasMes, historicas] = await Promise.all([
      this.deps.repos.ventas.obtenerPorComercio(
        comercio.id,
        rango.mesDesde,
        rango.mesHasta
      ),
      this.deps.repos.ventas.obtenerPorComercio(
        comercio.id,
        rango.desde,
        rango.hasta
      ),
    ]);

    const pronostico = calcularPronosticoMensual(ventasMes, historicas, ref);
    const mensaje = formatearPronostico(pronostico, comercio.nombre);
    return { pronostico, mensaje };
  }

  async manejarResumen(telefono: string, ref?: Date): Promise<boolean> {
    const { comercio } =
      await this.deps.repos.comercios.encontrarOCrearPorTelefono(telefono);
    const { mensaje } = await this.armarResumen(comercio, ref);
    await this.deps.sender.enviarMensaje(telefono, mensaje);
    return true;
  }

  async manejarPronostico(telefono: string, ref?: Date): Promise<boolean> {
    const { comercio } =
      await this.deps.repos.comercios.encontrarOCrearPorTelefono(telefono);
    const { mensaje } = await this.armarPronostico(comercio, ref);
    await this.deps.sender.enviarMensaje(telefono, mensaje);
    return true;
  }

  /**
   * Job: envía resumen de la semana anterior a todos los comercios activos
   */
  async enviarResumenSemanalATodos(
    lunes: Date = new Date()
  ): Promise<{ enviados: number; errores: number; comercioIds: string[] }> {
    const ventana = ventanaSemanaAnteriorParaLunes(lunes);
    const activos = await this.deps.repos.comercios.listarActivos();
    let enviados = 0;
    let errores = 0;
    const comercioIds: string[] = [];

    for (const comercio of activos) {
      try {
        const [ventas, anteriores] = await Promise.all([
          this.deps.repos.ventas.obtenerPorComercio(
            comercio.id,
            ventana.desde,
            ventana.hasta
          ),
          this.deps.repos.ventas.obtenerPorComercio(
            comercio.id,
            ventana.anteriorDesde,
            ventana.anteriorHasta
          ),
        ]);
        const resumen = calcularResumenSemanal(ventas, anteriores, ventana);
        const mensaje = formatearResumenSemanal(resumen, comercio.nombre);
        await this.deps.sender.enviarMensaje(
          comercio.telefono_whatsapp,
          mensaje
        );
        enviados += 1;
        comercioIds.push(comercio.id);
      } catch (err) {
        errores += 1;
        console.error(
          `Error enviando resumen a comercio ${comercio.id}:`,
          err
        );
      }
    }

    return { enviados, errores, comercioIds };
  }
}
