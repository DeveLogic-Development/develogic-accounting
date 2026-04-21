import { appConfig } from '@/config/appConfig';
import { getSupabaseClient } from './client';
import { ensureSupabaseSession, getSupabaseAuthIssue } from './auth-session';

const TABLE_NAME = 'runtime_app_states';

type RuntimeLoadResult<T> =
  | { ok: true; data: T | null; reason?: string }
  | { ok: false; reason: string };

type RuntimeSaveResult = { ok: true } | { ok: false; reason: string };

export function canUseSupabaseRuntimeState(): boolean {
  return appConfig.integrations.supabase.configured;
}

export async function loadRuntimeState<T>(stateKey: string): Promise<RuntimeLoadResult<T>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, reason: 'Supabase client is not configured.' };
  }

  const session = await ensureSupabaseSession();
  if (!session?.user?.id) {
    const authIssue = getSupabaseAuthIssue();
    return {
      ok: false,
      reason: authIssue
        ? `Supabase session unavailable. ${authIssue}`
        : 'Supabase session unavailable. Please sign in first.',
    };
  }

  const { data, error } = await client
    .from(TABLE_NAME)
    .select('state_json')
    .eq('user_id', session.user.id)
    .eq('state_key', stateKey)
    .maybeSingle();

  if (error) {
    return { ok: false, reason: error.message };
  }

  return {
    ok: true,
    data: (data?.state_json as T | undefined) ?? null,
  };
}

export async function saveRuntimeState<T>(stateKey: string, state: T): Promise<RuntimeSaveResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, reason: 'Supabase client is not configured.' };
  }

  const session = await ensureSupabaseSession();
  if (!session?.user?.id) {
    const authIssue = getSupabaseAuthIssue();
    return {
      ok: false,
      reason: authIssue
        ? `Supabase session unavailable. ${authIssue}`
        : 'Supabase session unavailable. Please sign in first.',
    };
  }

  const { error } = await client.from(TABLE_NAME).upsert(
    {
      user_id: session.user.id,
      state_key: stateKey,
      state_json: state,
      updated_by: session.user.id,
    },
    {
      onConflict: 'user_id,state_key',
    },
  );

  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}
