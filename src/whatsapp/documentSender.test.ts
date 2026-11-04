import { describe, it, expect, vi } from 'vitest';
import {
  MockDocumentSender,
  GraphDocumentSender,
  createDocumentSender,
} from './documentSender.js';

describe('DocumentSender', () => {
  it('Mock debería registrar el documento', async () => {
    const s = new MockDocumentSender();
    const r = await s.enviarDocumento({
      telefono: '54911',
      buffer: Buffer.from('abc'),
      filename: 'ventas.csv',
      mimeType: 'text/csv',
      caption: 'test',
    });
    expect(r.mocked).toBe(true);
    expect(s.sent).toHaveLength(1);
  });

  it('Graph debería subir media y enviar mensaje', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'media_99' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.doc' }] }),
      });

    const s = new GraphDocumentSender({
      accessToken: 'tok',
      phoneNumberId: '123',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const r = await s.enviarDocumento({
      telefono: '54911',
      buffer: Buffer.from('xlsx'),
      filename: 'ventas.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    expect(r.mediaId).toBe('media_99');
    expect(r.messageId).toBe('wamid.doc');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('createDocumentSender debería mockear sin credenciales', () => {
    expect(
      createDocumentSender({ accessToken: null, phoneNumberId: null })
    ).toBeInstanceOf(MockDocumentSender);
  });
});
