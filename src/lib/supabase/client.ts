import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { appConfig } from '@/config/appConfig';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!appConfig.integrations.supabase.configured) return null;
  if (cachedClient) return cachedClient;

  cachedClient = createClient(
    appConfig.integrations.supabase.url as string,
    appConfig.integrations.supabase.anonKey as string,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    },
  );

  return cachedClient;
}
