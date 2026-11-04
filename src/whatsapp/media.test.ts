/**
 * Tests del cliente de media de WhatsApp
 */

import { describe, it, expect, vi } from 'vitest';
import {
  MockMediaClient,
  GraphMediaClient,
  createMediaClient,
} from './media.js';

describe('Media client WhatsApp', () => {
  describe('MockMediaClient', () => {
    it('debería devolver buffer JPEG y URL mock', async () => {
      const client = new MockMediaClient();
      const result = await client.download('media_abc');

      expect(result.mediaId).toBe('media_abc');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.url).toContain('media_abc');
    });
  });

  describe('GraphMediaClient', () => {
    it('debería obtener metadata y descargar bytes', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            url: 'https://cdn.example.com/foto.jpg',
            mime_type: 'image/jpeg',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        });

      const client = new GraphMediaClient({
        accessToken: 'token',
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      const result = await client.download('mid_1');
      expect(result.buffer.equals(Buffer.from([1, 2, 3]))).toBe(true);
      expect(result.url).toBe('https://cdn.example.com/foto.jpg');
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('debería fallar si no hay access token', () => {
      expect(
        () => new GraphMediaClient({ accessToken: null })
      ).toThrow(/WHATSAPP_ACCESS_TOKEN/);
    });
  });

  describe('createMediaClient', () => {
    it('debería usar mock sin token', () => {
      const client = createMediaClient({ accessToken: null });
      expect(client).toBeInstanceOf(MockMediaClient);
    });

    it('debería usar Graph con token', () => {
      const client = createMediaClient({ accessToken: 'tok' });
      expect(client).toBeInstanceOf(GraphMediaClient);
    });
  });
});
