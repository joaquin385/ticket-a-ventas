import { describe, it, expect } from 'vitest';
import { parsearComando, calcularRango } from './commands.js';

describe('Comandos WhatsApp', () => {
  const ref = new Date('2024-11-15T12:00:00Z');

  it('calcularRango mes debería empezar el día 1', () => {
    const r = calcularRango('mes', ref);
    expect(r.desde).toBe('2024-11-01');
    expect(r.hasta).toBe('2024-11-15');
  });

  it('calcularRango semana debería cubrir 7 días', () => {
    const r = calcularRango('semana', ref);
    expect(r.desde).toBe('2024-11-09');
    expect(r.hasta).toBe('2024-11-15');
  });

  it('debería parsear "exportar mes"', () => {
    const c = parsearComando('exportar mes', ref);
    expect(c.tipo).toBe('exportar');
    if (c.tipo === 'exportar') {
      expect(c.formato).toBe('xlsx');
      expect(c.rango.etiqueta).toBe('mes');
      expect(c.rango.desde).toBe('2024-11-01');
    }
  });

  it('debería parsear "exportar semana csv"', () => {
    const c = parsearComando('exportar semana csv', ref);
    expect(c.tipo).toBe('exportar');
    if (c.tipo === 'exportar') {
      expect(c.formato).toBe('csv');
      expect(c.rango.etiqueta).toBe('semana');
    }
  });

  it('debería tratar "exportar" solo como mes xlsx', () => {
    const c = parsearComando('exportar', ref);
    expect(c.tipo).toBe('exportar');
    if (c.tipo === 'exportar') {
      expect(c.formato).toBe('xlsx');
      expect(c.rango.etiqueta).toBe('mes');
    }
  });

  it('debería ignorar texto que no es comando', () => {
    expect(parsearComando('hola').tipo).toBe('desconocido');
  });
});
