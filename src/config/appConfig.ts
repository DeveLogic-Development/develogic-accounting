export type RuntimeMode = 'development' | 'production' | 'test';

export interface AppConfig {
  runtime: {
    mode: RuntimeMode;
    isProductionLike: boolean;
  };
  app: {
    baseUrl?: string;
  };
  features: {
    emailEnabled: boolean;
    reportsEnabled: boolean;
  };
  integrations: {
    supabase: {
      url?: string;
      anonKey?: string;
      configured: boolean;
    };
    storage: {
      bucket?: string;
      configured: boolean;
    };
  };
  limits: {
    emailAttachmentMaxMb: number;
  };
  warnings: string[];
}

function asBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function asNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBaseUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, '');
}

const envExample =
  typeof __ENV_EXAMPLE__ !== 'undefined' ? __ENV_EXAMPLE__ : undefined;

function readEnv(
  env: Record<string, string | undefined>,
  key: string,
  includeExampleFallback: boolean,
): string | undefined {
  const direct = env[key]?.trim();
  if (direct) return direct;
  if (!includeExampleFallback) return undefined;
  const fallback = envExample?.[key]?.trim();
  return fallback || undefined;
}

export function createAppConfig(
  env: Record<string, string | undefined>,
  options?: { includeExampleFallback?: boolean },
): AppConfig {
  const includeExampleFallback = options?.includeExampleFallback ?? true;
  const mode = (env.MODE ?? 'development') as RuntimeMode;
  const isProductionLike = mode === 'production';

  const supabaseUrl = readEnv(env, 'VITE_SUPABASE_URL', includeExampleFallback);
  const supabaseAnonKey = readEnv(env, 'VITE_SUPABASE_ANON_KEY', includeExampleFallback);
  const storageBucket = readEnv(env, 'VITE_SUPABASE_STORAGE_BUCKET', includeExampleFallback);
  const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
  const storageConfigured = Boolean(supabaseConfigured && storageBucket);
  const fallbackBaseUrl =
    typeof window !== 'undefined' ? window.location.origin : undefined;

  const config: AppConfig = {
    runtime: {
      mode,
      isProductionLike,
    },
    app: {
      baseUrl: normalizeBaseUrl(
        readEnv(env, 'VITE_APP_BASE_URL', includeExampleFallback) ?? fallbackBaseUrl,
      ),
    },
    features: {
      emailEnabled: asBoolean(readEnv(env, 'VITE_FEATURE_EMAIL_ENABLED', includeExampleFallback), true),
      reportsEnabled: asBoolean(readEnv(env, 'VITE_FEATURE_REPORTS_ENABLED', includeExampleFallback), true),
    },
    integrations: {
      supabase: {
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
        configured: supabaseConfigured,
      },
      storage: {
        bucket: storageBucket,
        configured: storageConfigured,
      },
    },
    limits: {
      emailAttachmentMaxMb: asNumber(readEnv(env, 'VITE_EMAIL_MAX_ATTACHMENT_MB', includeExampleFallback), 5),
    },
    warnings: [],
  };

  const warnings: string[] = [];
  if (!config.app.baseUrl) {
    warnings.push('VITE_APP_BASE_URL is not set. Absolute links/integrations may be limited.');
  }
  if (!supabaseConfigured) {
    warnings.push('Supabase configuration is incomplete. Persistence/integration features may remain local only.');
  } else if (!storageConfigured) {
    warnings.push('Supabase storage bucket is not configured. File storage remains in local fallback mode.');
  }

  config.warnings = warnings;
  return config;
}

export const appConfig = createAppConfig(import.meta.env as unknown as Record<string, string | undefined>);
