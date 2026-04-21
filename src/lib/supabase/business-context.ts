import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { ensureSupabaseSession, getSupabaseAuthIssue } from './auth-session';

interface BusinessMembershipRow {
  business_id: string;
}

export interface SupabaseBusinessContext {
  client: SupabaseClient;
  userId: string;
  businessId: string;
}

type BusinessContextResult =
  | { ok: true; data: SupabaseBusinessContext }
  | { ok: false; reason: string };

async function findMembershipBusinessId(
  client: SupabaseClient,
  userId: string,
): Promise<{ businessId?: string; reason?: string }> {
  const membership = await client
    .from('business_users')
    .select('business_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<BusinessMembershipRow>();

  if (membership.error) {
    return { reason: membership.error.message };
  }

  return { businessId: membership.data?.business_id };
}

async function autoCreateBusiness(
  client: SupabaseClient,
  userId: string,
): Promise<{ businessId?: string; reason?: string }> {
  const insert = await client
    .from('businesses')
    .insert({
      name: 'DeveLogic Digital',
      legal_name: 'DeveLogic Digital',
      created_by: userId,
    })
    .select('id')
    .single<{ id: string }>();

  if (insert.error) {
    return { reason: insert.error.message };
  }

  return { businessId: insert.data.id };
}

export async function getSupabaseBusinessContext(
  options?: { autoCreateBusiness?: boolean },
): Promise<BusinessContextResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, reason: 'Supabase client is not configured.' };
  }

  const session = await ensureSupabaseSession();
  const userId = session?.user?.id;
  if (!userId) {
    const authIssue = getSupabaseAuthIssue();
    return {
      ok: false,
      reason: authIssue
        ? `Supabase session unavailable. ${authIssue}`
        : 'Supabase session unavailable. Please sign in.',
    };
  }

  const existing = await findMembershipBusinessId(client, userId);
  if (existing.reason) return { ok: false, reason: existing.reason };
  if (existing.businessId) {
    return {
      ok: true,
      data: {
        client,
        userId,
        businessId: existing.businessId,
      },
    };
  }

  if (!options?.autoCreateBusiness) {
    return { ok: false, reason: 'No active business membership found.' };
  }

  const created = await autoCreateBusiness(client, userId);
  if (created.reason) return { ok: false, reason: created.reason };
  if (created.businessId) {
    return {
      ok: true,
      data: {
        client,
        userId,
        businessId: created.businessId,
      },
    };
  }

  const membershipAfterCreate = await findMembershipBusinessId(client, userId);
  if (membershipAfterCreate.reason) return { ok: false, reason: membershipAfterCreate.reason };
  if (!membershipAfterCreate.businessId) {
    return { ok: false, reason: 'Unable to resolve a business for this user.' };
  }

  return {
    ok: true,
    data: {
      client,
      userId,
      businessId: membershipAfterCreate.businessId,
    },
  };
}
