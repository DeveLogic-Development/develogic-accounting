import { getSupabaseBusinessContext } from '@/lib/supabase/business-context';
import {
  ClientUpsertInput,
  CustomerComment,
  CustomerContactPerson,
  MasterClient,
  MasterDataSnapshot,
  MasterProductService,
  ProductServiceUpsertInput,
} from '../domain/types';

interface ClientRow {
  id: string;
  client_type: 'business' | 'individual';
  salutation: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  display_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  work_phone_country_code: string | null;
  work_phone_number: string | null;
  mobile_phone_country_code: string | null;
  mobile_phone_number: string | null;
  customer_language: string | null;
  currency_code: string | null;
  accounts_receivable_account_id: string | null;
  opening_balance: number | null;
  payment_terms_days: number | null;
  payment_terms_label: string | null;
  portal_enabled: boolean | null;
  website_url: string | null;
  department: string | null;
  designation: string | null;
  x_handle_or_url: string | null;
  skype: string | null;
  facebook: string | null;
  remarks: string | null;
  notes: string | null;
  customer_owner_user_id: string | null;
  unused_credits: number | null;
  custom_fields_json: Record<string, unknown> | null;
  reporting_tags_json: unknown[] | null;
  billing_attention: string | null;
  billing_country_region: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state_province: string | null;
  billing_postal_code: string | null;
  billing_country_code: string | null;
  billing_phone_country_code: string | null;
  billing_phone_number: string | null;
  billing_fax: string | null;
  shipping_attention: string | null;
  shipping_country_region: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state_province: string | null;
  shipping_postal_code: string | null;
  shipping_country_code: string | null;
  shipping_phone_country_code: string | null;
  shipping_phone_number: string | null;
  shipping_fax: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ClientContactRow {
  id: string;
  client_id: string;
  salutation: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  work_phone_country_code: string | null;
  work_phone_number: string | null;
  mobile_phone_country_code: string | null;
  mobile_phone_number: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface CustomerCommentRow {
  id: string;
  customer_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ProductServiceRow {
  id: string;
  item_type: 'product' | 'service';
  name: string;
  sku: string | null;
  description: string | null;
  unit_price: number;
  tax_setting_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TaxSettingRow {
  id: string;
  name: string;
}

type MasterDataLoadResult =
  | { ok: true; data: MasterDataSnapshot }
  | { ok: false; reason: string };

type MutationResult =
  | { ok: true; id: string }
  | { ok: false; reason: string };

function toStringRecord(
  value: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.entries(value).reduce<Record<string, string>>((acc, [key, item]) => {
    if (typeof item === 'string') acc[key] = item;
    return acc;
  }, {});
}

function toStringArray(value: unknown[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function choosePrimaryContact(
  contacts: CustomerContactPerson[],
): CustomerContactPerson | undefined {
  if (contacts.length === 0) return undefined;
  const explicitPrimary = contacts.find((contact) => contact.isPrimary);
  return explicitPrimary ?? contacts[0];
}

function parsePaymentTermsDays(value: string | undefined): number {
  if (!value) return 30;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 30;
  if (
    normalized === 'due on receipt' ||
    normalized === 'on receipt' ||
    normalized === 'immediate'
  ) {
    return 0;
  }

  const digits = normalized.match(/\d+/)?.[0];
  if (!digits) return 30;
  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed < 0) return 30;
  return parsed;
}

function normalizeDisplayName(input: ClientUpsertInput): string {
  const direct = input.displayName.trim();
  if (direct) return direct;

  const personName = [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(' ');
  if (personName) return personName;
  if (input.companyName?.trim()) return input.companyName.trim();
  if (input.email?.trim()) return input.email.trim();
  return 'Customer';
}

function normalizeContactPersons(
  input: CustomerContactPerson[] | undefined,
): CustomerContactPerson[] {
  const contacts = (input ?? [])
    .map((contact) => ({
      ...contact,
      salutation: contact.salutation?.trim() || undefined,
      firstName: contact.firstName?.trim() || undefined,
      lastName: contact.lastName?.trim() || undefined,
      email: contact.email?.trim() || undefined,
      workPhoneCountryCode: contact.workPhoneCountryCode?.trim() || undefined,
      workPhoneNumber: contact.workPhoneNumber?.trim() || undefined,
      mobilePhoneCountryCode: contact.mobilePhoneCountryCode?.trim() || undefined,
      mobilePhoneNumber: contact.mobilePhoneNumber?.trim() || undefined,
    }))
    .filter((contact) => {
      return Boolean(
        contact.firstName ||
          contact.lastName ||
          contact.email ||
          contact.workPhoneNumber ||
          contact.mobilePhoneNumber,
      );
    });

  if (contacts.length === 0) return [];

  let hasPrimary = contacts.some((contact) => contact.isPrimary);
  return contacts.map((contact, index) => {
    if (!hasPrimary && index === 0) {
      hasPrimary = true;
      return { ...contact, isPrimary: true };
    }
    return { ...contact, isPrimary: Boolean(contact.isPrimary) };
  });
}

function mapClientRowToDomain(
  row: ClientRow,
  contacts: CustomerContactPerson[],
): MasterClient {
  const primaryContact = choosePrimaryContact(contacts);
  const paymentTerms =
    row.payment_terms_label ??
    (row.payment_terms_days === 0
      ? 'Due on Receipt'
      : `${row.payment_terms_days ?? 30} Days`);
  const displayName = row.display_name;

  return {
    id: row.id,
    customerType: row.client_type,
    salutation: row.salutation ?? undefined,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    companyName: row.company_name ?? row.legal_name ?? undefined,
    displayName,
    name: displayName,
    email: row.email ?? primaryContact?.email ?? undefined,
    workPhoneCountryCode:
      row.work_phone_country_code ?? primaryContact?.workPhoneCountryCode ?? undefined,
    workPhoneNumber: row.work_phone_number ?? primaryContact?.workPhoneNumber ?? undefined,
    mobilePhoneCountryCode:
      row.mobile_phone_country_code ?? primaryContact?.mobilePhoneCountryCode ?? undefined,
    mobilePhoneNumber: row.mobile_phone_number ?? primaryContact?.mobilePhoneNumber ?? undefined,
    phone: row.phone ?? row.work_phone_number ?? primaryContact?.workPhoneNumber ?? undefined,
    customerLanguage: row.customer_language ?? 'English',
    currencyCode: row.currency_code ?? 'ZAR',
    accountsReceivableAccountId: row.accounts_receivable_account_id ?? undefined,
    openingBalance: Number(row.opening_balance ?? 0),
    paymentTerms,
    portalEnabled: Boolean(row.portal_enabled),
    websiteUrl: row.website_url ?? undefined,
    department: row.department ?? undefined,
    designation: row.designation ?? undefined,
    xHandleOrUrl: row.x_handle_or_url ?? undefined,
    skype: row.skype ?? undefined,
    facebook: row.facebook ?? undefined,
    remarks: row.remarks ?? row.notes ?? undefined,
    customFields: toStringRecord(row.custom_fields_json),
    reportingTags: toStringArray(row.reporting_tags_json),
    customerOwnerUserId: row.customer_owner_user_id ?? undefined,
    unusedCredits: Number(row.unused_credits ?? 0),
    billingAddress: {
      attention: row.billing_attention ?? undefined,
      countryRegion: row.billing_country_region ?? row.billing_country_code ?? undefined,
      line1: row.billing_address_line1 ?? undefined,
      line2: row.billing_address_line2 ?? undefined,
      city: row.billing_city ?? undefined,
      stateRegion: row.billing_state_province ?? undefined,
      postalCode: row.billing_postal_code ?? undefined,
      phoneCountryCode: row.billing_phone_country_code ?? undefined,
      phoneNumber: row.billing_phone_number ?? undefined,
      fax: row.billing_fax ?? undefined,
    },
    shippingAddress: {
      attention: row.shipping_attention ?? undefined,
      countryRegion: row.shipping_country_region ?? row.shipping_country_code ?? undefined,
      line1: row.shipping_address_line1 ?? undefined,
      line2: row.shipping_address_line2 ?? undefined,
      city: row.shipping_city ?? undefined,
      stateRegion: row.shipping_state_province ?? undefined,
      postalCode: row.shipping_postal_code ?? undefined,
      phoneCountryCode: row.shipping_phone_country_code ?? undefined,
      phoneNumber: row.shipping_phone_number ?? undefined,
      fax: row.shipping_fax ?? undefined,
    },
    contactPersons: contacts,
    contactName: primaryContact
      ? [primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(' ') ||
        primaryContact.email
      : undefined,
    contactEmail: primaryContact?.email ?? undefined,
    contactPhone: primaryContact?.workPhoneNumber ?? primaryContact?.mobilePhoneNumber ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClientInputToDb(
  input: ClientUpsertInput,
  userId: string,
  businessId: string,
): Record<string, unknown> {
  const displayName = normalizeDisplayName(input);
  const paymentTerms = input.paymentTerms?.trim() || '30 Days';
  const workPhoneNumber = input.workPhoneNumber?.trim() || null;
  const workPhoneCountryCode = input.workPhoneCountryCode?.trim() || null;
  const phoneLegacy = workPhoneNumber
    ? `${workPhoneCountryCode ?? ''}${workPhoneNumber}`.trim()
    : null;

  return {
    business_id: businessId,
    client_type: input.customerType,
    salutation: input.salutation?.trim() || null,
    first_name: input.firstName?.trim() || null,
    last_name: input.lastName?.trim() || null,
    company_name: input.companyName?.trim() || null,
    legal_name: input.companyName?.trim() || null,
    display_name: displayName,
    email: input.email?.trim() || null,
    phone: phoneLegacy || null,
    work_phone_country_code: workPhoneCountryCode,
    work_phone_number: workPhoneNumber,
    mobile_phone_country_code: input.mobilePhoneCountryCode?.trim() || null,
    mobile_phone_number: input.mobilePhoneNumber?.trim() || null,
    customer_language: input.customerLanguage?.trim() || 'English',
    currency_code: input.currencyCode?.trim() || 'ZAR',
    accounts_receivable_account_id: input.accountsReceivableAccountId?.trim() || null,
    opening_balance: Number(input.openingBalance ?? 0),
    payment_terms_days: parsePaymentTermsDays(paymentTerms),
    payment_terms_label: paymentTerms,
    portal_enabled: Boolean(input.portalEnabled),
    website_url: input.websiteUrl?.trim() || null,
    department: input.department?.trim() || null,
    designation: input.designation?.trim() || null,
    x_handle_or_url: input.xHandleOrUrl?.trim() || null,
    skype: input.skype?.trim() || null,
    facebook: input.facebook?.trim() || null,
    notes: input.remarks?.trim() || null,
    remarks: input.remarks?.trim() || null,
    customer_owner_user_id: input.customerOwnerUserId?.trim() || null,
    custom_fields_json: input.customFields ?? {},
    reporting_tags_json: input.reportingTags ?? [],
    billing_attention: input.billingAddress?.attention?.trim() || null,
    billing_country_region: input.billingAddress?.countryRegion?.trim() || null,
    billing_address_line1: input.billingAddress?.line1?.trim() || null,
    billing_address_line2: input.billingAddress?.line2?.trim() || null,
    billing_city: input.billingAddress?.city?.trim() || null,
    billing_state_province: input.billingAddress?.stateRegion?.trim() || null,
    billing_postal_code: input.billingAddress?.postalCode?.trim() || null,
    billing_country_code: null,
    billing_phone_country_code: input.billingAddress?.phoneCountryCode?.trim() || null,
    billing_phone_number: input.billingAddress?.phoneNumber?.trim() || null,
    billing_fax: input.billingAddress?.fax?.trim() || null,
    shipping_attention: input.shippingAddress?.attention?.trim() || null,
    shipping_country_region: input.shippingAddress?.countryRegion?.trim() || null,
    shipping_address_line1: input.shippingAddress?.line1?.trim() || null,
    shipping_address_line2: input.shippingAddress?.line2?.trim() || null,
    shipping_city: input.shippingAddress?.city?.trim() || null,
    shipping_state_province: input.shippingAddress?.stateRegion?.trim() || null,
    shipping_postal_code: input.shippingAddress?.postalCode?.trim() || null,
    shipping_country_code: null,
    shipping_phone_country_code: input.shippingAddress?.phoneCountryCode?.trim() || null,
    shipping_phone_number: input.shippingAddress?.phoneNumber?.trim() || null,
    shipping_fax: input.shippingAddress?.fax?.trim() || null,
    is_active: input.isActive,
    created_by: userId,
  };
}

async function replaceClientContacts(args: {
  client: Awaited<ReturnType<typeof getSupabaseBusinessContext>> extends { ok: true; data: infer T }
    ? T extends { client: infer C }
      ? C
      : never
    : never;
  businessId: string;
  userId: string;
  clientId: string;
  contacts: CustomerContactPerson[];
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { client, businessId, userId, clientId, contacts } = args;
  const nowIso = new Date().toISOString();

  const deleteExisting = await client
    .from('client_contacts')
    .update({ deleted_at: nowIso, updated_at: nowIso })
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .is('deleted_at', null);

  if (deleteExisting.error) return { ok: false, reason: deleteExisting.error.message };

  if (contacts.length === 0) return { ok: true };

  const rows = contacts.map((contact, index) => {
    const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
    const fallbackFullName = fullName || contact.email || `Contact ${index + 1}`;
    return {
      business_id: businessId,
      client_id: clientId,
      full_name: fallbackFullName,
      salutation: contact.salutation ?? null,
      first_name: contact.firstName ?? null,
      last_name: contact.lastName ?? null,
      email: contact.email ?? null,
      work_phone_country_code: contact.workPhoneCountryCode ?? null,
      work_phone_number: contact.workPhoneNumber ?? null,
      mobile_phone_country_code: contact.mobilePhoneCountryCode ?? null,
      mobile_phone_number: contact.mobilePhoneNumber ?? null,
      phone: contact.workPhoneNumber ?? contact.mobilePhoneNumber ?? null,
      is_primary: Boolean(contact.isPrimary),
      receives_documents: true,
      created_by: userId,
    };
  });

  const insertContacts = await client.from('client_contacts').insert(rows);
  if (insertContacts.error) return { ok: false, reason: insertContacts.error.message };

  return { ok: true };
}

export async function loadSupabaseMasterData(): Promise<MasterDataLoadResult> {
  const context = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (!context.ok) return { ok: false, reason: context.reason };

  const { client, businessId } = context.data;

  const [clientsRes, contactsRes, productsRes, taxesRes] = await Promise.all([
    client
      .from('clients')
      .select(
        [
          'id',
          'client_type',
          'salutation',
          'first_name',
          'last_name',
          'company_name',
          'display_name',
          'legal_name',
          'email',
          'phone',
          'work_phone_country_code',
          'work_phone_number',
          'mobile_phone_country_code',
          'mobile_phone_number',
          'customer_language',
          'currency_code',
          'accounts_receivable_account_id',
          'opening_balance',
          'payment_terms_days',
          'payment_terms_label',
          'portal_enabled',
          'website_url',
          'department',
          'designation',
          'x_handle_or_url',
          'skype',
          'facebook',
          'remarks',
          'notes',
          'customer_owner_user_id',
          'unused_credits',
          'custom_fields_json',
          'reporting_tags_json',
          'billing_attention',
          'billing_country_region',
          'billing_address_line1',
          'billing_address_line2',
          'billing_city',
          'billing_state_province',
          'billing_postal_code',
          'billing_country_code',
          'billing_phone_country_code',
          'billing_phone_number',
          'billing_fax',
          'shipping_attention',
          'shipping_country_region',
          'shipping_address_line1',
          'shipping_address_line2',
          'shipping_city',
          'shipping_state_province',
          'shipping_postal_code',
          'shipping_country_code',
          'shipping_phone_country_code',
          'shipping_phone_number',
          'shipping_fax',
          'is_active',
          'created_at',
          'updated_at',
        ].join(', '),
      )
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('display_name', { ascending: true }),
    client
      .from('client_contacts')
      .select(
        'id, client_id, salutation, first_name, last_name, full_name, email, work_phone_country_code, work_phone_number, mobile_phone_country_code, mobile_phone_number, phone, is_primary, created_at, updated_at',
      )
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    client
      .from('products_services')
      .select(
        'id, item_type, name, sku, description, unit_price, tax_setting_id, is_active, created_at, updated_at',
      )
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    client
      .from('tax_settings')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .is('deleted_at', null),
  ]);

  if (clientsRes.error) return { ok: false, reason: clientsRes.error.message };
  if (contactsRes.error) return { ok: false, reason: contactsRes.error.message };
  if (productsRes.error) return { ok: false, reason: productsRes.error.message };
  if (taxesRes.error) return { ok: false, reason: taxesRes.error.message };

  const contactsByClient = new Map<string, CustomerContactPerson[]>();
  (contactsRes.data as ClientContactRow[]).forEach((contactRow) => {
    const entries = contactsByClient.get(contactRow.client_id) ?? [];
    entries.push({
      id: contactRow.id,
      salutation: contactRow.salutation ?? undefined,
      firstName:
        contactRow.first_name ?? contactRow.full_name?.split(' ')?.[0] ?? undefined,
      lastName:
        contactRow.last_name ??
        (contactRow.full_name
          ? contactRow.full_name.split(' ').slice(1).join(' ') || undefined
          : undefined),
      email: contactRow.email ?? undefined,
      workPhoneCountryCode: contactRow.work_phone_country_code ?? undefined,
      workPhoneNumber: contactRow.work_phone_number ?? contactRow.phone ?? undefined,
      mobilePhoneCountryCode: contactRow.mobile_phone_country_code ?? undefined,
      mobilePhoneNumber: contactRow.mobile_phone_number ?? undefined,
      isPrimary: contactRow.is_primary,
      createdAt: contactRow.created_at,
      updatedAt: contactRow.updated_at,
    });
    contactsByClient.set(contactRow.client_id, entries);
  });

  const clients: MasterClient[] = (clientsRes.data as ClientRow[]).map((row) =>
    mapClientRowToDomain(row, contactsByClient.get(row.id) ?? []),
  );

  const taxNameById = new Map(
    (taxesRes.data as TaxSettingRow[]).map((tax) => [tax.id, tax.name]),
  );

  const productsServices: MasterProductService[] = (productsRes.data as ProductServiceRow[]).map(
    (row) => ({
      id: row.id,
      name: row.name,
      type: row.item_type,
      sku: row.sku ?? undefined,
      description: row.description ?? undefined,
      unitPrice: Number(row.unit_price ?? 0),
      taxCategory: row.tax_setting_id
        ? taxNameById.get(row.tax_setting_id) ?? 'Unassigned'
        : 'Unassigned',
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );

  return {
    ok: true,
    data: {
      clients,
      productsServices,
      source: 'supabase',
      lastSyncedAt: new Date().toISOString(),
    },
  };
}

export async function createClientInSupabase(input: ClientUpsertInput): Promise<MutationResult> {
  const context = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (!context.ok) return { ok: false, reason: context.reason };
  const { client, businessId, userId } = context.data;

  const insertClient = await client
    .from('clients')
    .insert(mapClientInputToDb(input, userId, businessId))
    .select('id')
    .single<{ id: string }>();

  if (insertClient.error) return { ok: false, reason: insertClient.error.message };
  const clientId = insertClient.data.id;

  const contactsResult = await replaceClientContacts({
    client,
    businessId,
    userId,
    clientId,
    contacts: normalizeContactPersons(input.contactPersons),
  });
  if (!contactsResult.ok) return { ok: false, reason: contactsResult.reason };

  return { ok: true, id: clientId };
}

export async function updateClientInSupabase(
  clientId: string,
  input: ClientUpsertInput,
): Promise<MutationResult> {
  const context = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (!context.ok) return { ok: false, reason: context.reason };
  const { client, businessId, userId } = context.data;

  const updatePayload = mapClientInputToDb(input, userId, businessId);
  delete updatePayload.business_id;
  delete updatePayload.created_by;
  updatePayload.updated_at = new Date().toISOString();

  const updateClient = await client
    .from('clients')
    .update(updatePayload)
    .eq('business_id', businessId)
    .eq('id', clientId);

  if (updateClient.error) return { ok: false, reason: updateClient.error.message };

  if (input.contactPersons) {
    const contactsResult = await replaceClientContacts({
      client,
      businessId,
      userId,
      clientId,
      contacts: normalizeContactPersons(input.contactPersons),
    });
    if (!contactsResult.ok) return { ok: false, reason: contactsResult.reason };
  }

  return { ok: true, id: clientId };
}

export async function deleteClientInSupabase(clientId: string): Promise<MutationResult> {
  const context = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (!context.ok) return { ok: false, reason: context.reason };
  const { client, businessId } = context.data;
  const nowIso = new Date().toISOString();

  // Important: soft-delete contacts before client.
  // The DB trigger on client_contacts validates the referenced client and
  // can reject updates after the parent client is soft-deleted.
  const softDeleteContacts = await client
    .from('client_contacts')
    .update({
      deleted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .is('deleted_at', null);

  if (softDeleteContacts.error) return { ok: false, reason: softDeleteContacts.error.message };

  const softDeleteClient = await client
    .from('clients')
    .update({
      is_active: false,
      deleted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('business_id', businessId)
    .eq('id', clientId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (softDeleteClient.error) return { ok: false, reason: softDeleteClient.error.message };
  if (!softDeleteClient.data?.id) {
    return { ok: false, reason: 'Customer not found or already deleted.' };
  }

  return { ok: true, id: softDeleteClient.data.id };
}

export async function loadClientCommentsFromSupabase(
  clientId: string,
): Promise<{ ok: true; data: CustomerComment[] } | { ok: false; reason: string }> {
  const context = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (!context.ok) return { ok: false, reason: context.reason };
  const { client, businessId } = context.data;

  const commentsRes = await client
    .from('customer_comments')
    .select('id, customer_id, body, created_by, created_at, updated_at')
    .eq('business_id', businessId)
    .eq('customer_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (commentsRes.error) return { ok: false, reason: commentsRes.error.message };

  const comments = (commentsRes.data as CustomerCommentRow[]).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    body: row.body,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  }));
  return { ok: true, data: comments };
}

export async function createClientCommentInSupabase(input: {
  clientId: string;
  body: string;
}): Promise<MutationResult> {
  const context = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (!context.ok) return { ok: false, reason: context.reason };
  const { client, businessId, userId } = context.data;

  const insert = await client
    .from('customer_comments')
    .insert({
      business_id: businessId,
      customer_id: input.clientId,
      body: input.body.trim(),
      created_by: userId,
    })
    .select('id')
    .single<{ id: string }>();

  if (insert.error) return { ok: false, reason: insert.error.message };
  return { ok: true, id: insert.data.id };
}

export async function createProductServiceInSupabase(
  input: ProductServiceUpsertInput,
): Promise<MutationResult> {
  const context = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (!context.ok) return { ok: false, reason: context.reason };
  const { client, businessId, userId } = context.data;

  const insertItem = await client
    .from('products_services')
    .insert({
      business_id: businessId,
      item_type: input.type,
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      description: input.description?.trim() || null,
      unit_price: Number(input.unitPrice),
      is_active: input.isActive,
      created_by: userId,
    })
    .select('id')
    .single<{ id: string }>();

  if (insertItem.error) return { ok: false, reason: insertItem.error.message };
  return { ok: true, id: insertItem.data.id };
}

export async function updateProductServiceInSupabase(
  productId: string,
  input: ProductServiceUpsertInput,
): Promise<MutationResult> {
  const context = await getSupabaseBusinessContext({ autoCreateBusiness: true });
  if (!context.ok) return { ok: false, reason: context.reason };
  const { client, businessId } = context.data;

  const updateItem = await client
    .from('products_services')
    .update({
      item_type: input.type,
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      description: input.description?.trim() || null,
      unit_price: Number(input.unitPrice),
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('business_id', businessId)
    .eq('id', productId);

  if (updateItem.error) return { ok: false, reason: updateItem.error.message };
  return { ok: true, id: productId };
}
