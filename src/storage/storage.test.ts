import { describe, it, expect, vi } from 'vitest';
import {
  MockStorage,
  CloudflareR2Storage,
  createStorage,
} from './storage.js';

describe('Storage', () => {
  it('MockStorage debería devolver URL mock', async () => {
    const s = new MockStorage();
    const r = await s.upload({
      key: 'a.jpg',
      body: Buffer.from('x'),
      contentType: 'image/jpeg',
    });
    expect(r.url).toContain('a.jpg');
    expect(s.uploads).toHaveLength(1);
  });

  it('CloudflareR2Storage debería firmar y PUT', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    const s = new CloudflareR2Storage({
      accountId: 'acc',
      accessKeyId: 'AKI',
      secretAccessKey: 'SECRET',
      bucket: 'fotos',
      publicBaseUrl: 'https://cdn.example.com',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const r = await s.upload({
      key: 'x.jpg',
      body: Buffer.from('hello'),
      contentType: 'image/jpeg',
    });

    expect(r.url).toBe('https://cdn.example.com/x.jpg');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain('r2.cloudflarestorage.com');
    expect((init as RequestInit).method).toBe('PUT');
    expect(
      ((init as RequestInit).headers as Record<string, string>).authorization
    ).toMatch(/^AWS4-HMAC-SHA256/);
  });

  it('createStorage debería usar mock sin credenciales', () => {
    const s = createStorage({
      r2: {
        accountId: null,
        accessKeyId: null,
        secretAccessKey: null,
        bucket: null,
        publicBaseUrl: null,
      },
    });
    expect(s).toBeInstanceOf(MockStorage);
  });
});
