import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../db/memoryStore.js';
import { createRepositories } from '../db/repositories/index.js';
import { loadConfig } from '../config.js';
import { MockMercadoPagoClient } from '../mercadopago/client.js';
import {
  SuscripcionService,
  trialVigente,
  mapearEstadoMp,
} from './suscripcionService.js';

describe('SuscripcionService', () => {
  let store: MemoryStore;
  let mp: MockMercadoPagoClient;
  let service: SuscripcionService;
  let comercioId: string;

  beforeEach(async () => {
    store = new MemoryStore();
    mp = new MockMercadoPagoClient();
    const repos = createRepositories(
      loadConfig({ ...process.env, DATABASE_URL: '' }),
      store
    );
    service = new SuscripcionService(repos, mp, {
      precioMensualArs: 7000,
      trialDias: 14,
      trialFotos: 30,
      baseUrl: 'http://localhost:3000',
    });
    const { comercio } = await repos.comercios.encontrarOCrearPorTelefono(
      '5491111222333',
      'Kiosco Billing'
    );
    comercioId = comercio.id;
  });

  it('debería crear trial de 14 días / 30 fotos', async () => {
    const sub = await service.asegurarTrial(
      comercioId,
      new Date('2024-11-01T12:00:00Z')
    );
    expect(sub.estado).toBe('trial');
    expect(sub.fecha_fin_trial).toBe('2024-11-15');
    expect(sub.limite_fotos_trial).toBe(30);
    expect(trialVigente(sub, new Date('2024-11-10T12:00:00Z'))).toBe(true);
  });

  it('trial debería vencer por fecha', async () => {
    const sub = await service.asegurarTrial(
      comercioId,
      new Date('2024-11-01T12:00:00Z')
    );
    expect(trialVigente(sub, new Date('2024-11-16T12:00:00Z'))).toBe(false);
    const acceso = await service.evaluarAcceso(
      comercioId,
      new Date('2024-11-16T12:00:00Z')
    );
    expect(acceso.permitido).toBe(false);
    if (!acceso.permitido) expect(acceso.motivo).toBe('trial_vencido');
  });

  it('trial debería vencer por fotos', async () => {
    await service.asegurarTrial(comercioId, new Date('2024-11-01T12:00:00Z'));
    for (let i = 0; i < 30; i++) {
      await service.registrarFotoUsada(comercioId);
    }
    const acceso = await service.evaluarAcceso(
      comercioId,
      new Date('2024-11-05T12:00:00Z')
    );
    expect(acceso.permitido).toBe(false);
  });

  it('obtenerLinkPago debería crear preapproval mock', async () => {
    const { initPoint } = await service.obtenerLinkPago(comercioId);
    expect(initPoint).toContain('mercadopago');
    expect(mp.created).toHaveLength(1);
    expect(mp.created[0].transactionAmount).toBe(7000);
  });

  it('aplicarEstadoDesdeMp debería activar suscripción', async () => {
    const { suscripcion } = await service.obtenerLinkPago(comercioId);
    mp.setStatus(suscripcion.mercadopago_preapproval_id!, 'authorized');
    const updated = await service.aplicarEstadoDesdeMp(
      suscripcion.mercadopago_preapproval_id!,
      'authorized'
    );
    expect(updated?.estado).toBe('activa');
  });

  it('mapearEstadoMp debería cubrir estados', () => {
    expect(mapearEstadoMp('authorized')).toBe('activa');
    expect(mapearEstadoMp('paused')).toBe('pausada');
    expect(mapearEstadoMp('cancelled')).toBe('cancelada');
  });

  it('mensajeEstado debería mencionar trial', async () => {
    const sub = await service.asegurarTrial(comercioId);
    const msg = service.mensajeEstado(sub);
    expect(msg).toMatch(/Prueba|plan/i);
  });
});
