import { getSupabaseBusinessContext } from '@/lib/supabase/business-context';
import { canUseSupabaseRuntimeState, loadRuntimeState } from '@/lib/supabase/runtime-state';
import {
  applyBusinessBrandTheme,
  BusinessSettings,
  loadBusinessSettings,
  saveBusinessSettings,
  splitAddressLines,
} from '../domain/business-settings';

interface BusinessRow {
  id: string;
  name: string | null;
  legal_name: string | null;
  registration_number: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country_code: string | null;
  currency_code: string | null;
  timezone: string | null;
}

function buildAddressFromBusinessRow(row: BusinessRow): string {
  const lines = [
    row.address_line1,
    row.address_line2,
    [row.city, row.state_province, row.postal_code].filter(Boolean).join(', '),
    row.country_code,
  ]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];
  return lines.join('\n');
}

function mapBusinessRowToSettings(row: BusinessRow): Partial<BusinessSettings> {
  const businessName = row.legal_name?.trim() || row.name?.trim() || '';
  return {
    businessName: businessName || undefined,
    registrationNumber: row.registration_number?.trim() || undefined,
    vatNumber: row.vat_number?.trim() || undefined,
    email: row.email?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
    website: row.website?.trim() || undefined,
    currency: row.currency_code?.trim() || undefined,
    timezone: row.timezone?.trim() || undefined,
    address: buildAddressFromBusinessRow(row),
    senderName: businessName ? `${businessName} Finance` : undefined,
    senderEmail: row.email?.trim() || undefined,
    replyTo: row.email?.trim() || undefined,
  };
}

export async function hydrateBusinessSettingsForSession(): Promise<{
  ok: boolean;
  reason?: string;
  data?: BusinessSettings;
}> {
  const local = loadBusinessSettings();
  let merged: BusinessSettings = { ...local };
  let syncedFromRemote = false;

  const businessContext = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (businessContext.ok) {
    const { client, businessId } = businessContext.data;
    const businessRes = await client
      .from('businesses')
      .select(
        'id, name, legal_name, registration_number, vat_number, email, phone, website, address_line1, address_line2, city, state_province, postal_code, country_code, currency_code, timezone',
      )
      .eq('id', businessId)
      .maybeSingle<BusinessRow>();

    if (!businessRes.error && businessRes.data) {
      merged = {
        ...merged,
        ...mapBusinessRowToSettings(businessRes.data),
      };
      syncedFromRemote = true;
    }
  }

  if (canUseSupabaseRuntimeState()) {
    const runtime = await loadRuntimeState<BusinessSettings>('business_settings');
    if (runtime.ok && runtime.data) {
      merged = {
        ...merged,
        ...runtime.data,
      };
      syncedFromRemote = true;
    }
  }

  if (syncedFromRemote) {
    saveBusinessSettings(merged);
    applyBusinessBrandTheme(merged);
  }

  return {
    ok: true,
    data: merged,
  };
}

export async function persistBusinessProfileToSupabase(
  settings: BusinessSettings,
): Promise<{ ok: boolean; reason?: string }> {
  const context = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (!context.ok) {
    return { ok: false, reason: context.reason };
  }

  const { client, businessId } = context.data;
  const lines = splitAddressLines(settings.address);
  const line1 = lines[0] ?? null;
  const line2 = lines.slice(1).join(', ') || null;

  const updateRes = await client
    .from('businesses')
    .update({
      name: settings.businessName.trim() || null,
      legal_name: settings.businessName.trim() || null,
      registration_number: settings.registrationNumber.trim() || null,
      vat_number: settings.vatNumber.trim() || null,
      email: settings.email.trim() || null,
      phone: settings.phone.trim() || null,
      website: settings.website.trim() || null,
      address_line1: line1,
      address_line2: line2,
      currency_code: settings.currency.trim() || null,
      timezone: settings.timezone.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', businessId);

  if (updateRes.error) {
    return { ok: false, reason: updateRes.error.message };
  }

  return { ok: true };
}
