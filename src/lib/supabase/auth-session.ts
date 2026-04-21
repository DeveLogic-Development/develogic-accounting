import { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

let cachedSession: Session | null = null;
let lastAuthIssue: string | null = null;

function setAuthIssue(issue: string | null) {
  lastAuthIssue = issue;
}

export function getSupabaseAuthIssue(): string | null {
  return lastAuthIssue;
}

export function syncSupabaseSession(session: Session | null) {
  cachedSession = session;
  if (session?.user?.id) {
    setAuthIssue(null);
  } else {
    setAuthIssue('No active Supabase session. Please sign in.');
  }
}

export async function ensureSupabaseSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) {
    setAuthIssue('Supabase client is not configured.');
    return null;
  }

  if (cachedSession?.user?.id) {
    return cachedSession;
  }

  const existing = await client.auth.getSession();
  const session = existing.data.session ?? null;
  cachedSession = session;
  if (session?.user?.id) {
    setAuthIssue(null);
    return session;
  }

  setAuthIssue('No active Supabase session. Please sign in.');
  return null;
}

