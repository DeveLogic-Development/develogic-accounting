import { describe, expect, it } from 'vitest';
import { createAppConfig } from '../appConfig';

describe('app config', () => {
  it('builds safe defaults when env is sparse', () => {
    const config = createAppConfig({
      MODE: 'development',
    });

    expect(config.features.emailEnabled).toBe(true);
    expect(config.integrations.supabase.configured).toBe(false);
    expect(config.warnings.length).toBeGreaterThan(0);
  });

  it('marks supabase and storage configured when env values are present', () => {
    const config = createAppConfig({
      MODE: 'production',
      VITE_APP_BASE_URL: 'https://app.example.com',
      VITE_SUPABASE_URL: 'https://xyz.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon',
      VITE_SUPABASE_STORAGE_BUCKET: 'documents',
    });

    expect(config.runtime.isProductionLike).toBe(true);
    expect(config.integrations.supabase.configured).toBe(true);
    expect(config.integrations.storage.configured).toBe(true);
  });
});
