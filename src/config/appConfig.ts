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

export function createAppConfig(env: Record<string, string | undefined>): AppConfig {
  const mode = (env.MODE ?? 'development') as RuntimeMode;
  const isProductionLike = mode === 'production';

  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || undefined;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim() || undefined;
  const storageBucket = env.VITE_SUPABASE_STORAGE_BUCKET?.trim() || undefined;
  const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
  const storageConfigured = Boolean(supabaseConfigured && storageBucket);

  const config: AppConfig = {
    runtime: {
      mode,
      isProductionLike,
    },
    app: {
      baseUrl: normalizeBaseUrl(env.VITE_APP_BASE_URL),
    },
    features: {
      emailEnabled: asBoolean(env.VITE_FEATURE_EMAIL_ENABLED, true),
      reportsEnabled: asBoolean(env.VITE_FEATURE_REPORTS_ENABLED, true),
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
      emailAttachmentMaxMb: asNumber(env.VITE_EMAIL_MAX_ATTACHMENT_MB, 5),
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
