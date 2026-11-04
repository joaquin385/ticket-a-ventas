import { describe, it, expect } from 'vitest';
import {
  formatearMontoARS,
  formatearFecha,
  resumenVentaRegistrada,
  resumenPendienteRevision,
} from './resumen.js';
import type { VentaExtracted } from '../extraction/schema.js';

describe('Resúmenes WhatsApp', () => {
  const venta: VentaExtracted = {
    fecha: '2024-11-04',
    items: [
      { descripcion: 'A', cantidad: 1, subtotal: 1000 },
      { descripcion: 'B', cantidad: 2, subtotal: 2000 },
    ],
    total: 3000,
    medio_pago: 'efectivo',
    confianza: 0.9,
  };

  it('debería formatear fecha DD/MM/YYYY', () => {
    expect(formatearFecha('2024-11-04')).toBe('04/11/2024');
  });

  it('debería incluir monto e ítems en el resumen', () => {
    const msg = resumenVentaRegistrada(venta);
    expect(msg).toContain('✅');
    expect(msg).toContain('2 ítems');
    expect(msg).toContain('04/11/2024');
    expect(formatearMontoARS(3000)).toMatch(/3.?000/);
  });

  it('debería devolver mensaje de revisión pendiente', () => {
    expect(resumenPendienteRevision()).toContain('revisamos');
  });
});
