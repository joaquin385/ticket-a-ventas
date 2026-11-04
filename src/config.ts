/**
 * Configuración de la aplicación desde variables de entorno
 *
 * Cuando faltan credenciales, los módulos usan mocks (modo desarrollo/tests).
 */

export type VisionProvider = 'openai' | 'openai-compatible' | 'mock';

export type AppConfig = {
  port: number;
  nodeEnv: string;
  baseUrl: string;
  whatsapp: {
    verifyToken: string;
    accessToken: string | null;
    phoneNumberId: string | null;
    appSecret: string | null;
    apiVersion: string;
  };
  vision: {
    apiKey: string | null;
    provider: VisionProvider;
    baseUrl: string;
    model: string;
  };
  databaseUrl: string | null;
  r2: {
    accountId: string | null;
    accessKeyId: string | null;
    secretAccessKey: string | null;
    bucket: string | null;
    publicBaseUrl: string | null;
  };
  minConfidenceScore: number;
  /** Token Bearer para GET /api/export */
  exportApiToken: string | null;
  /** Token Bearer para POST /api/jobs/* (fallback: EXPORT_API_TOKEN / API_TOKEN) */
  jobsApiToken: string | null;
  mercadopago: {
    accessToken: string | null;
    publicKey: string | null;
    webhookSecret: string | null;
  };
  billing: {
    precioMensualArs: number;
    trialDias: number;
    trialFotos: number;
  };
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const providerRaw = (env.VISION_API_PROVIDER ?? 'mock').toLowerCase();
  const provider: VisionProvider =
    providerRaw === 'openai' || providerRaw === 'openai-compatible'
      ? providerRaw
      : 'mock';

  return {
    port: Number(env.PORT ?? 3000),
    nodeEnv: env.NODE_ENV ?? 'development',
    baseUrl: env.BASE_URL ?? 'http://localhost:3000',
    whatsapp: {
      verifyToken: env.WHATSAPP_VERIFY_TOKEN ?? 'dev_verify_token',
      accessToken: env.WHATSAPP_ACCESS_TOKEN || null,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || null,
      appSecret: env.WHATSAPP_APP_SECRET || null,
      apiVersion: env.WHATSAPP_API_VERSION ?? 'v21.0',
    },
    vision: {
      apiKey: env.VISION_API_KEY || null,
      provider: env.VISION_API_KEY ? provider : 'mock',
      baseUrl:
        env.VISION_API_BASE_URL ?? 'https://api.openai.com/v1',
      model: env.VISION_MODEL ?? 'gpt-4o',
    },
    databaseUrl: env.DATABASE_URL || null,
    r2: {
      accountId: env.R2_ACCOUNT_ID || null,
      accessKeyId: env.R2_ACCESS_KEY_ID || null,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY || null,
      bucket: env.R2_BUCKET || null,
      publicBaseUrl: env.R2_PUBLIC_BASE_URL || null,
    },
    minConfidenceScore: Number(env.MIN_CONFIDENCE_SCORE ?? 0.7),
    exportApiToken: env.EXPORT_API_TOKEN || env.API_TOKEN || null,
    jobsApiToken:
      env.JOBS_API_TOKEN || env.EXPORT_API_TOKEN || env.API_TOKEN || null,
    mercadopago: {
      accessToken: env.MERCADOPAGO_ACCESS_TOKEN || null,
      publicKey: env.MERCADOPAGO_PUBLIC_KEY || null,
      webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET || null,
    },
    billing: {
      precioMensualArs: Number(env.SUBSCRIPTION_PRICE_ARS ?? 7000),
      trialDias: Number(env.TRIAL_DAYS ?? 14),
      trialFotos: Number(env.TRIAL_PHOTOS ?? 30),
    },
  };
}

export function whatsappConfigured(config: AppConfig): boolean {
  return Boolean(config.whatsapp.accessToken && config.whatsapp.phoneNumberId);
}

export function r2Configured(config: AppConfig): boolean {
  const { accountId, accessKeyId, secretAccessKey, bucket } = config.r2;
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket);
}
