import { getSupabaseBusinessContext } from '@/lib/supabase/business-context';

export type SequenceResetPeriod = 'never' | 'yearly' | 'monthly';

export interface TaxRuleSetting {
  id: string;
  name: string;
  code: string;
  rate: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface NumberingSetting {
  id?: string;
  prefix: string;
  nextNumber: number;
  padding: number;
  resetPeriod: SequenceResetPeriod;
}

export interface TaxNumberingSettings {
  taxRules: TaxRuleSetting[];
  quote: NumberingSetting;
  invoice: NumberingSetting;
  strictSequence: boolean;
}

interface TaxRow {
  id: string;
  name: string;
  code: string | null;
  rate: number;
  is_default: boolean;
  is_active: boolean;
}

interface SequenceRow {
  id: string;
  sequence_type: 'quote' | 'invoice';
  prefix: string;
  next_number: number;
  padding: number;
  reset_period: SequenceResetPeriod;
}

const STORAGE_KEY = 'develogic_tax_numbering_fallback_v1';

function createDefaults(): TaxNumberingSettings {
  return {
    taxRules: [
      { id: 'fallback-tax-vat15', name: 'VAT 15%', code: 'VAT15', rate: 15, isDefault: true, isActive: true },
      { id: 'fallback-tax-vat0', name: 'Zero Rated', code: 'VAT0', rate: 0, isDefault: false, isActive: true },
    ],
    quote: {
      prefix: 'QUO-',
      nextNumber: 1,
      padding: 5,
      resetPeriod: 'yearly',
    },
    invoice: {
      prefix: 'INV-',
      nextNumber: 1,
      padding: 5,
      resetPeriod: 'yearly',
    },
    strictSequence: true,
  };
}

function loadFallback(): TaxNumberingSettings {
  if (typeof window === 'undefined') return createDefaults();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createDefaults();
  try {
    const parsed = JSON.parse(raw) as TaxNumberingSettings;
    return parsed;
  } catch {
    return createDefaults();
  }
}

function saveFallback(value: TaxNumberingSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export async function loadTaxNumberingSettings(): Promise<{
  ok: true;
  data: TaxNumberingSettings;
  mode: 'supabase' | 'fallback';
  warning?: string;
} | {
  ok: false;
  error: string;
}> {
  const context = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (!context.ok) {
    return {
      ok: true,
      data: loadFallback(),
      mode: 'fallback',
      warning: `Supabase unavailable. Using local fallback: ${context.reason}`,
    };
  }

  const { client, businessId } = context.data;
  const [taxRes, sequenceRes] = await Promise.all([
    client
      .from('tax_settings')
      .select('id, name, code, rate, is_default, is_active')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    client
      .from('numbering_sequences')
      .select('id, sequence_type, prefix, next_number, padding, reset_period')
      .eq('business_id', businessId)
      .is('deleted_at', null),
  ]);

  if (taxRes.error) return { ok: false, error: taxRes.error.message };
  if (sequenceRes.error) return { ok: false, error: sequenceRes.error.message };

  const taxes = (taxRes.data as TaxRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code ?? '',
    rate: Number(row.rate),
    isDefault: row.is_default,
    isActive: row.is_active,
  }));

  const sequences = sequenceRes.data as SequenceRow[];
  const quoteSeq = sequences.find((row) => row.sequence_type === 'quote');
  const invoiceSeq = sequences.find((row) => row.sequence_type === 'invoice');
  const defaults = createDefaults();

  const data: TaxNumberingSettings = {
    taxRules: taxes.length > 0 ? taxes : defaults.taxRules,
    quote: quoteSeq
      ? {
          id: quoteSeq.id,
          prefix: quoteSeq.prefix,
          nextNumber: Number(quoteSeq.next_number),
          padding: Number(quoteSeq.padding),
          resetPeriod: quoteSeq.reset_period,
        }
      : defaults.quote,
    invoice: invoiceSeq
      ? {
          id: invoiceSeq.id,
          prefix: invoiceSeq.prefix,
          nextNumber: Number(invoiceSeq.next_number),
          padding: Number(invoiceSeq.padding),
          resetPeriod: invoiceSeq.reset_period,
        }
      : defaults.invoice,
    strictSequence: true,
  };

  saveFallback(data);

  return {
    ok: true,
    data,
    mode: 'supabase',
  };
}

export async function saveTaxNumberingSettings(
  input: TaxNumberingSettings,
): Promise<{ ok: true; mode: 'supabase' | 'fallback'; warning?: string } | { ok: false; error: string }> {
  const context = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (!context.ok) {
    saveFallback(input);
    return {
      ok: true,
      mode: 'fallback',
      warning: `Saved locally because Supabase is unavailable: ${context.reason}`,
    };
  }

  const { client, businessId, userId } = context.data;

  const normalizedTaxRows = input.taxRules.map((rule, index) => ({
    id: rule.id.startsWith('new-tax-') ? undefined : rule.id,
    business_id: businessId,
    name: rule.name.trim(),
    code: rule.code.trim() || null,
    rate: Math.max(0, Math.min(100, Number(rule.rate))),
    is_default: rule.isDefault && index === 0 ? true : rule.isDefault,
    is_active: rule.isActive,
    created_by: userId,
  }));

  const upsertTaxes = await client.from('tax_settings').upsert(normalizedTaxRows, {
    onConflict: 'id',
    ignoreDuplicates: false,
  });
  if (upsertTaxes.error) return { ok: false, error: upsertTaxes.error.message };

  const sequenceRows = [
    {
      id: input.quote.id,
      business_id: businessId,
      sequence_type: 'quote',
      prefix: input.quote.prefix,
      next_number: Math.max(1, Math.floor(input.quote.nextNumber)),
      padding: Math.max(1, Math.min(12, Math.floor(input.quote.padding))),
      reset_period: input.quote.resetPeriod,
      created_by: userId,
    },
    {
      id: input.invoice.id,
      business_id: businessId,
      sequence_type: 'invoice',
      prefix: input.invoice.prefix,
      next_number: Math.max(1, Math.floor(input.invoice.nextNumber)),
      padding: Math.max(1, Math.min(12, Math.floor(input.invoice.padding))),
      reset_period: input.invoice.resetPeriod,
      created_by: userId,
    },
  ];

  const upsertSequences = await client.from('numbering_sequences').upsert(sequenceRows, {
    onConflict: 'business_id,sequence_type',
    ignoreDuplicates: false,
  });
  if (upsertSequences.error) return { ok: false, error: upsertSequences.error.message };

  saveFallback(input);

  return { ok: true, mode: 'supabase' };
}

