import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../memoryStore.js';
import { MemoryComercioRepository } from './comercioRepository.js';
import { MemoryFotoRepository } from './fotoRepository.js';
import { MemoryVentaRepository } from './ventaRepository.js';
import alta from '../../extraction/fixtures/venta-alta-confianza.json' with { type: 'json' };
import { VentaExtractedSchema } from '../../extraction/schema.js';

describe('Repositorios in-memory', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it('debería crear comercio y usuario por teléfono', async () => {
    const repo = new MemoryComercioRepository(store);
    const a = await repo.encontrarOCrearPorTelefono('549111');
    const b = await repo.encontrarOCrearPorTelefono('549111');
    expect(a.creado).toBe(true);
    expect(b.creado).toBe(false);
    expect(a.comercio.id).toBe(b.comercio.id);
  });

  it('debería guardar foto y actualizar estado', async () => {
    const comercios = new MemoryComercioRepository(store);
    const fotos = new MemoryFotoRepository(store);
    const { comercio, usuario } =
      await comercios.encontrarOCrearPorTelefono('549111');

    const foto = await fotos.guardar({
      comercio_id: comercio.id,
      usuario_id: usuario.id,
      whatsapp_media_id: 'm1',
    });
    expect(foto.estado).toBe('pendiente');

    const updated = await fotos.actualizarEstado(
      foto.id,
      'procesada',
      'https://r2/x.jpg'
    );
    expect(updated.estado).toBe('procesada');
    expect(updated.url_foto).toBe('https://r2/x.jpg');
  });

  it('debería crear venta con items', async () => {
    const comercios = new MemoryComercioRepository(store);
    const ventas = new MemoryVentaRepository(store);
    const { comercio } = await comercios.encontrarOCrearPorTelefono('549111');
    const extracted = VentaExtractedSchema.parse(alta);

    const venta = await ventas.crear({
      foto_id: null,
      comercio_id: comercio.id,
      extracted,
      requiere_revision: false,
    });

    expect(venta.items).toHaveLength(3);
    const list = await ventas.obtenerPorComercio(comercio.id);
    expect(list).toHaveLength(1);
  });
});
