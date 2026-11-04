/**
 * Interfaz de storage de fotos (Cloudflare R2 / mock)
 */

export type UploadInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type UploadResult = {
  key: string;
  url: string;
};

export interface IStorage {
  upload(input: UploadInput): Promise<UploadResult>;
}

/**
 * Mock: no sube nada; retorna URL local ficticia
 */
export class MockStorage implements IStorage {
  public uploads: UploadInput[] = [];

  async upload(input: UploadInput): Promise<UploadResult> {
    this.uploads.push(input);
    return {
      key: input.key,
      url: `https://mock-r2.local/${input.key}`,
    };
  }
}

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string | null;
  fetchFn?: typeof fetch;
};

/**
 * Cloudflare R2 vía API S3-compatible (PutObject firmado AWS Sig V4)
 */
export class CloudflareR2Storage implements IStorage {
  private accountId: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private bucket: string;
  private publicBaseUrl: string | null;
  private fetchFn: typeof fetch;

  constructor(config: R2Config) {
    this.accountId = config.accountId;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicBaseUrl ?? null;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const host = `${this.accountId}.r2.cloudflarestorage.com`;
    const path = `/${this.bucket}/${input.key}`;
    const url = `https://${host}${path}`;
    const amzDate = new Date()
      .toISOString()
      .replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';
    const payloadHash = await sha256Hex(input.body);

    const headers: Record<string, string> = {
      host,
      'content-type': input.contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };

    const signedHeaders = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort()
      .join(';');

    const canonicalHeaders = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort()
      .map((k) => `${k}:${headers[k].trim()}\n`)
      .join('');

    const canonicalRequest = [
      'PUT',
      path,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = await getSignatureKey(
      this.secretAccessKey,
      dateStamp,
      region,
      service
    );
    const signature = await hmacHex(signingKey, stringToSign);

    headers.authorization = [
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', ');

    const res = await this.fetchFn(url, {
      method: 'PUT',
      headers,
      body: input.body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`R2 upload falló (${res.status}): ${text}`);
    }

    const publicUrl = this.publicBaseUrl
      ? `${this.publicBaseUrl.replace(/\/$/, '')}/${input.key}`
      : url;

    return { key: input.key, url: publicUrl };
  }
}

async function sha256Hex(data: string | Buffer): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(data).digest('hex');
}

async function hmac(
  key: Buffer | string,
  data: string
): Promise<Buffer> {
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', key).update(data).digest();
}

async function hmacHex(key: Buffer, data: string): Promise<string> {
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', key).update(data).digest('hex');
}

async function getSignatureKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<Buffer> {
  const kDate = await hmac(`AWS4${secret}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

export function createStorage(config: {
  r2: {
    accountId: string | null;
    accessKeyId: string | null;
    secretAccessKey: string | null;
    bucket: string | null;
    publicBaseUrl: string | null;
  };
}): IStorage {
  const { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl } =
    config.r2;

  if (accountId && accessKeyId && secretAccessKey && bucket) {
    return new CloudflareR2Storage({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      publicBaseUrl,
    });
  }

  console.warn('[storage] Sin credenciales R2: usando MockStorage');
  return new MockStorage();
}
