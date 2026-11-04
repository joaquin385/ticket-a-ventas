/**
 * Tests para los schemas de validación
 */

import { describe, it, expect } from 'vitest';
import {
  ItemVentaSchema,
  VentaExtractedSchema,
  validarConsistenciaTotal,
  requiereRevision,
  type VentaExtracted,
} from './schema.js';

describe('Schemas de Validación', () => {
  describe('ItemVentaSchema', () => {
    it('debería validar un item correcto', () => {
      const item = {
        descripcion: 'Coca Cola',
        cantidad: 2,
        precio_unitario: 100,
        subtotal: 200,
      };

      const resultado = ItemVentaSchema.safeParse(item);
      expect(resultado.success).toBe(true);
    });

    it('debería usar cantidad 1.0 por defecto', () => {
      const item = {
        descripcion: 'Pan',
        subtotal: 500,
      };

      const resultado = ItemVentaSchema.parse(item);
      expect(resultado.cantidad).toBe(1.0);
    });

    it('debería rechazar descripción vacía', () => {
      const item = {
        descripcion: '',
        subtotal: 100,
      };

      const resultado = ItemVentaSchema.safeParse(item);
      expect(resultado.success).toBe(false);
    });

    it('debería rechazar cantidad negativa', () => {
      const item = {
        descripcion: 'Producto',
        cantidad: -1,
        subtotal: 100,
      };

      const resultado = ItemVentaSchema.safeParse(item);
      expect(resultado.success).toBe(false);
    });

    it('debería rechazar subtotal negativo', () => {
      const item = {
        descripcion: 'Producto',
        subtotal: -100,
      };

      const resultado = ItemVentaSchema.safeParse(item);
      expect(resultado.success).toBe(false);
    });
  });

  describe('VentaExtractedSchema', () => {
    it('debería validar una venta correcta', () => {
      const venta = {
        fecha: '2024-11-04',
        hora: '14:30',
        items: [
          {
            descripcion: 'Producto 1',
            cantidad: 1,
            subtotal: 100,
          },
        ],
        total: 100,
        medio_pago: 'efectivo' as const,
        confianza: 0.95,
      };

      const resultado = VentaExtractedSchema.safeParse(venta);
      expect(resultado.success).toBe(true);
    });

    it('debería rechazar fecha con formato incorrecto', () => {
      const venta = {
        fecha: '04/11/2024', // formato incorrecto
        items: [{ descripcion: 'A', subtotal: 100 }],
        total: 100,
        medio_pago: null,
        confianza: 0.9,
      };

      const resultado = VentaExtractedSchema.safeParse(venta);
      expect(resultado.success).toBe(false);
    });

    it('debería rechazar array de items vacío', () => {
      const venta = {
        fecha: '2024-11-04',
        items: [],
        total: 0,
        medio_pago: null,
        confianza: 0.9,
      };

      const resultado = VentaExtractedSchema.safeParse(venta);
      expect(resultado.success).toBe(false);
    });

    it('debería rechazar confianza fuera de rango [0, 1]', () => {
      const ventaBaja = {
        fecha: '2024-11-04',
        items: [{ descripcion: 'A', subtotal: 100 }],
        total: 100,
        medio_pago: null,
        confianza: -0.1,
      };

      const ventaAlta = {
        fecha: '2024-11-04',
        items: [{ descripcion: 'A', subtotal: 100 }],
        total: 100,
        medio_pago: null,
        confianza: 1.5,
      };

      expect(VentaExtractedSchema.safeParse(ventaBaja).success).toBe(false);
      expect(VentaExtractedSchema.safeParse(ventaAlta).success).toBe(false);
    });

    it('debería aceptar medio_pago null', () => {
      const venta = {
        fecha: '2024-11-04',
        items: [{ descripcion: 'A', subtotal: 100 }],
        total: 100,
        medio_pago: null,
        confianza: 0.9,
      };

      const resultado = VentaExtractedSchema.safeParse(venta);
      expect(resultado.success).toBe(true);
    });

    it('debería aceptar medios de pago válidos', () => {
      const mediosPago = ['efectivo', 'debito', 'credito', 'transferencia'] as const;

      mediosPago.forEach((medio) => {
        const venta = {
          fecha: '2024-11-04',
          items: [{ descripcion: 'A', subtotal: 100 }],
          total: 100,
          medio_pago: medio,
          confianza: 0.9,
        };

        const resultado = VentaExtractedSchema.safeParse(venta);
        expect(resultado.success).toBe(true);
      });
    });
  });

  describe('validarConsistenciaTotal', () => {
    it('debería aprobar cuando el total coincide exactamente', () => {
      const venta: VentaExtracted = {
        fecha: '2024-11-04',
        items: [
          { descripcion: 'A', cantidad: 1, subtotal: 100 },
          { descripcion: 'B', cantidad: 1, subtotal: 200 },
        ],
        total: 300,
        medio_pago: null,
        confianza: 0.9,
      };

      expect(validarConsistenciaTotal(venta)).toBe(true);
    });

    it('debería aprobar cuando la diferencia está dentro de la tolerancia', () => {
      const venta: VentaExtracted = {
        fecha: '2024-11-04',
        items: [
          { descripcion: 'A', cantidad: 1, subtotal: 100.33 },
          { descripcion: 'B', cantidad: 1, subtotal: 200.67 },
        ],
        total: 301, // redondeo
        medio_pago: null,
        confianza: 0.9,
      };

      expect(validarConsistenciaTotal(venta)).toBe(true);
    });

    it('debería rechazar cuando la diferencia supera la tolerancia', () => {
      const venta: VentaExtracted = {
        fecha: '2024-11-04',
        items: [
          { descripcion: 'A', cantidad: 1, subtotal: 100 },
        ],
        total: 150, // 50 pesos de diferencia
        medio_pago: null,
        confianza: 0.9,
      };

      expect(validarConsistenciaTotal(venta)).toBe(false);
    });
  });

  describe('requiereRevision', () => {
    it('debería requerir revisión cuando la confianza es baja', () => {
      const venta: VentaExtracted = {
        fecha: '2024-11-04',
        items: [{ descripcion: 'A', cantidad: 1, subtotal: 100 }],
        total: 100,
        medio_pago: null,
        confianza: 0.5, // baja confianza
      };

      expect(requiereRevision(venta)).toBe(true);
    });

    it('debería requerir revisión cuando el total es inconsistente', () => {
      const venta: VentaExtracted = {
        fecha: '2024-11-04',
        items: [{ descripcion: 'A', cantidad: 1, subtotal: 100 }],
        total: 200, // no coincide
        medio_pago: null,
        confianza: 0.95,
      };

      expect(requiereRevision(venta)).toBe(true);
    });

    it('debería requerir revisión cuando el total es sospechosamente alto', () => {
      const venta: VentaExtracted = {
        fecha: '2024-11-04',
        items: [{ descripcion: 'A', cantidad: 1, subtotal: 2_000_000 }],
        total: 2_000_000,
        medio_pago: null,
        confianza: 0.95,
      };

      expect(requiereRevision(venta)).toBe(true);
    });

    it('NO debería requerir revisión cuando todo está bien', () => {
      const venta: VentaExtracted = {
        fecha: '2024-11-04',
        items: [
          { descripcion: 'A', cantidad: 2, subtotal: 200 },
          { descripcion: 'B', cantidad: 1, subtotal: 150 },
        ],
        total: 350,
        medio_pago: 'efectivo',
        confianza: 0.92,
      };

      expect(requiereRevision(venta)).toBe(false);
    });
  });
});
