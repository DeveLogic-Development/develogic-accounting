/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_BASE_URL?: string;
  readonly VITE_FEATURE_EMAIL_ENABLED?: string;
  readonly VITE_FEATURE_REPORTS_ENABLED?: string;
  readonly VITE_EMAIL_MAX_ATTACHMENT_MB?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_STORAGE_BUCKET?: string;
  readonly VITE_SUPABASE_EMAIL?: string;
  readonly VITE_SUPABASE_PASSWORD?: string;
  readonly VITE_SUPABASE_AUTO_SIGNUP?: string;
  readonly VITE_EMAIL_TRANSPORT_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __ENV_EXAMPLE__: Record<string, string> | undefined;
