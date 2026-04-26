import { createClient } from '@supabase/supabase-js';

const ACCOUNTING_STATE_KEY = 'accounting';
const BUSINESS_SETTINGS_STATE_KEY = 'business_settings';

const DEFAULT_SETTINGS = {
  businessName: 'DeveLogic Accounting',
  senderEmail: '',
  eftEnabled: true,
  eftPublicSubmissionEnabled: true,
  eftBankName: '',
  eftAccountHolder: '',
  eftAccountNumber: '',
  eftBranchCode: '',
  eftAccountType: '',
  eftSwiftBic: '',
  eftInstructionNotes: '',
  eftProofAllowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  eftProofMaxFileSizeBytes: 10 * 1024 * 1024,
};

function asString(value, fallback = '') {
  if (value == null) return fallback;
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toMinor(value) {
  return Math.max(0, Math.round(asNumber(value, 0) * 100));
}

function looksLikeOpaqueIdentifier(value) {
  const normalized = asString(value);
  if (!normalized) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    return true;
  }
  if (/^[a-z]+_[a-z0-9]{8,}$/i.test(normalized)) {
    return true;
  }
  if (/^[a-z0-9]{20,}$/i.test(normalized)) {
    return true;
  }
  return false;
}

function generateId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return {
      ok: false,
      error:
        'Server-side Supabase configuration is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    };
  }

  return {
    ok: true,
    client: createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

function normalizeSettings(rawSettings, rawBusiness) {
  return {
    ...DEFAULT_SETTINGS,
    ...(rawBusiness || {}),
    ...(rawSettings || {}),
    eftProofAllowedMimeTypes:
      Array.isArray(rawSettings?.eftProofAllowedMimeTypes) && rawSettings.eftProofAllowedMimeTypes.length > 0
        ? rawSettings.eftProofAllowedMimeTypes
        : Array.isArray(rawBusiness?.eftProofAllowedMimeTypes) && rawBusiness.eftProofAllowedMimeTypes.length > 0
          ? rawBusiness.eftProofAllowedMimeTypes
          : DEFAULT_SETTINGS.eftProofAllowedMimeTypes,
    eftProofMaxFileSizeBytes: Math.max(
      1024,
      asNumber(
        rawSettings?.eftProofMaxFileSizeBytes ?? rawBusiness?.eftProofMaxFileSizeBytes,
        DEFAULT_SETTINGS.eftProofMaxFileSizeBytes,
      ),
    ),
  };
}

function calculateRuntimeInvoiceTotals(invoice) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const subtotal = items.reduce((sum, item) => {
    const quantity = asNumber(item?.quantity, 0);
    const unitPriceMinor = asNumber(item?.unitPriceMinor, 0);
    const discountPercent = asNumber(item?.discountPercent, 0);
    const lineBase = quantity * unitPriceMinor;
    const lineDiscount = lineBase * (discountPercent / 100);
    return sum + (lineBase - lineDiscount);
  }, 0);

  const tax = items.reduce((sum, item) => {
    const quantity = asNumber(item?.quantity, 0);
    const unitPriceMinor = asNumber(item?.unitPriceMinor, 0);
    const discountPercent = asNumber(item?.discountPercent, 0);
    const taxRatePercent = asNumber(item?.taxRatePercent, 0);
    const lineBase = quantity * unitPriceMinor;
    const lineDiscount = lineBase * (discountPercent / 100);
    const lineNet = lineBase - lineDiscount;
    return sum + lineNet * (taxRatePercent / 100);
  }, 0);

  const documentDiscountPercent = asNumber(invoice?.documentDiscountPercent, 0);
  const documentDiscount = subtotal * (documentDiscountPercent / 100);
  const adjustmentMinor = asNumber(invoice?.adjustmentMinor, 0);
  const total = subtotal - documentDiscount + tax + adjustmentMinor;

  return {
    totalMinor: Math.max(0, Math.round(total)),
  };
}

function sumRuntimePaidMinor(state, invoiceId) {
  const payments = Array.isArray(state?.payments) ? state.payments : [];
  return payments
    .filter((payment) => payment?.invoiceId === invoiceId)
    .reduce((sum, payment) => sum + asNumber(payment?.amountMinor, 0), 0);
}

function evaluatePublicEligibility(context) {
  if (!context.settings.eftEnabled) {
    return { allowed: false, reason: 'EFT payments are currently disabled.' };
  }
  if (!context.settings.eftPublicSubmissionEnabled) {
    return { allowed: false, reason: 'Public proof submissions are currently disabled.' };
  }
  if (context.invoice.status === 'void') {
    return { allowed: false, reason: 'This invoice is void and cannot accept submissions.' };
  }
  if (context.invoice.status === 'draft') {
    return { allowed: false, reason: 'This invoice is still a draft and cannot accept submissions.' };
  }
  if (context.invoice.outstandingMinor <= 0) {
    return { allowed: false, reason: 'This invoice is already fully paid.' };
  }

  return { allowed: true };
}

function shapeContextPayload(context) {
  return {
    token: context.token,
    source: context.source,
    invoice: {
      id: context.invoice.id,
      invoiceNumber: context.invoice.invoiceNumber,
      clientName: context.invoice.clientName,
      issueDate: context.invoice.issueDate,
      dueDate: context.invoice.dueDate,
      currencyCode: context.invoice.currencyCode,
      status: context.invoice.status,
      totalMinor: context.invoice.totalMinor,
      outstandingMinor: context.invoice.outstandingMinor,
      paymentReference: context.invoice.paymentReference,
    },
    settings: {
      businessName: context.settings.businessName,
      senderEmail: context.settings.senderEmail || context.settings.email || '',
      eftBankName: context.settings.eftBankName,
      eftAccountHolder: context.settings.eftAccountHolder,
      eftAccountNumber: context.settings.eftAccountNumber,
      eftBranchCode: context.settings.eftBranchCode,
      eftAccountType: context.settings.eftAccountType,
      eftSwiftBic: context.settings.eftSwiftBic,
      eftInstructionNotes: context.settings.eftInstructionNotes,
      eftProofAllowedMimeTypes: context.settings.eftProofAllowedMimeTypes,
      eftProofMaxFileSizeBytes: context.settings.eftProofMaxFileSizeBytes,
      eftEnabled: context.settings.eftEnabled,
      eftPublicSubmissionEnabled: context.settings.eftPublicSubmissionEnabled,
    },
    eligibility: evaluatePublicEligibility(context),
  };
}

async function loadBusinessSettingsForUser(client, userId) {
  if (!userId) return DEFAULT_SETTINGS;

  const { data: stateRow } = await client
    .from('runtime_app_states')
    .select('state_json')
    .eq('user_id', userId)
    .eq('state_key', BUSINESS_SETTINGS_STATE_KEY)
    .maybeSingle();

  return normalizeSettings(stateRow?.state_json, null);
}

async function resolveClientDisplayName(client, clientId, fallbackName) {
  const normalizedClientId = asString(clientId);
  const normalizedFallback = asString(fallbackName);

  if (normalizedClientId) {
    const { data, error } = await client
      .from('clients')
      .select('display_name,company_name,first_name,last_name,email')
      .eq('id', normalizedClientId)
      .maybeSingle();

    if (!error && data) {
      const displayName = asString(data.display_name);
      if (displayName) return displayName;

      const companyName = asString(data.company_name);
      if (companyName) return companyName;

      const personName = [asString(data.first_name), asString(data.last_name)]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (personName) return personName;

      const email = asString(data.email);
      if (email) return email;
    }
  }

  if (normalizedFallback && !looksLikeOpaqueIdentifier(normalizedFallback)) {
    return normalizedFallback;
  }

  return 'Customer';
}

async function findContextFromRuntimeState(client, token) {
  const { data, error } = await client
    .from('runtime_app_states')
    .select('user_id, state_json')
    .eq('state_key', ACCOUNTING_STATE_KEY);

  if (error) {
    return { ok: false, error: error.message };
  }

  for (const row of data ?? []) {
    const state = row?.state_json;
    if (!state || typeof state !== 'object') continue;

    const invoices = Array.isArray(state.invoices) ? state.invoices : [];
    const invoice = invoices.find(
      (entry) =>
        entry &&
        entry.publicPaymentEnabled !== false &&
        asString(entry.publicPaymentToken) === token,
    );
    if (!invoice) continue;

    const totals = calculateRuntimeInvoiceTotals(invoice);
    const paidMinor = sumRuntimePaidMinor(state, invoice.id);
    const outstandingMinor = Math.max(0, totals.totalMinor - paidMinor);
    const settings = await loadBusinessSettingsForUser(client, row.user_id);
    const clientName = await resolveClientDisplayName(
      client,
      invoice.clientId,
      invoice.clientName || invoice.clientId,
    );

    return {
      ok: true,
      data: {
        source: 'runtime_state',
        token,
        userId: row.user_id,
        state,
        invoice,
        invoiceIndex: invoices.findIndex((entry) => entry?.id === invoice.id),
        invoiceData: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
          clientName,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          currencyCode: asString(invoice.currencyCode || 'ZAR'),
          status: asString(invoice.status || 'draft'),
          totalMinor: totals.totalMinor,
          outstandingMinor,
          paymentReference: asString(invoice.eftPaymentReference || invoice.invoiceNumber),
        },
        settings,
      },
    };
  }

  return { ok: true, data: null };
}

async function findContextFromDatabase(client, token) {
  const { data: invoice, error } = await client
    .from('invoices')
    .select(
      'id,business_id,client_id,invoice_number,status,issue_date,due_date,currency_code,total,balance_due,eft_payment_reference,public_payment_enabled,public_payment_token,deleted_at',
    )
    .eq('public_payment_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    const code = asString(error.code);
    const message = asString(error.message);
    const isSchemaCompatibilityIssue =
      code === '42703' ||
      code === '42P01' ||
      /does not exist/i.test(message);
    if (isSchemaCompatibilityIssue) {
      return { ok: true, data: null };
    }
    return { ok: false, error: message || 'Unable to resolve invoice from database.' };
  }
  if (!invoice || invoice.public_payment_enabled === false) {
    return { ok: true, data: null };
  }

  const { data: business } = await client
    .from('businesses')
    .select(
      'name,email,eft_enabled,eft_public_submission_enabled,eft_bank_name,eft_account_holder,eft_account_number,eft_branch_code,eft_account_type,eft_swift_bic,eft_instruction_notes,eft_proof_allowed_mime_types,eft_proof_max_file_size_bytes',
    )
    .eq('id', invoice.business_id)
    .maybeSingle();

  const { data: customer } = await client
    .from('clients')
    .select('display_name')
    .eq('id', invoice.client_id)
    .maybeSingle();

  const settings = normalizeSettings(
    {
      businessName: asString(business?.name, DEFAULT_SETTINGS.businessName),
      senderEmail: asString(business?.email, ''),
      eftEnabled: business?.eft_enabled ?? DEFAULT_SETTINGS.eftEnabled,
      eftPublicSubmissionEnabled:
        business?.eft_public_submission_enabled ?? DEFAULT_SETTINGS.eftPublicSubmissionEnabled,
      eftBankName: asString(business?.eft_bank_name),
      eftAccountHolder: asString(business?.eft_account_holder),
      eftAccountNumber: asString(business?.eft_account_number),
      eftBranchCode: asString(business?.eft_branch_code),
      eftAccountType: asString(business?.eft_account_type),
      eftSwiftBic: asString(business?.eft_swift_bic),
      eftInstructionNotes: asString(business?.eft_instruction_notes),
      eftProofAllowedMimeTypes: Array.isArray(business?.eft_proof_allowed_mime_types)
        ? business.eft_proof_allowed_mime_types
        : DEFAULT_SETTINGS.eftProofAllowedMimeTypes,
      eftProofMaxFileSizeBytes:
        asNumber(business?.eft_proof_max_file_size_bytes, DEFAULT_SETTINGS.eftProofMaxFileSizeBytes),
    },
    business,
  );

  return {
    ok: true,
    data: {
      source: 'database',
      token,
      invoice: invoice,
      invoiceData: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientId: invoice.client_id,
        clientName: asString(customer?.display_name, 'Client'),
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        currencyCode: asString(invoice.currency_code || 'ZAR').toUpperCase(),
        status: asString(invoice.status || 'draft'),
        totalMinor: toMinor(invoice.total),
        outstandingMinor: toMinor(invoice.balance_due),
        paymentReference: asString(invoice.eft_payment_reference || invoice.invoice_number),
      },
      settings,
    },
  };
}

export async function resolvePublicInvoicePaymentContext(token) {
  const normalizedToken = asString(token);
  if (!normalizedToken) {
    return { ok: false, status: 400, error: 'Payment token is required.' };
  }

  const clientResult = getSupabaseAdminClient();
  if (!clientResult.ok) {
    return { ok: false, status: 503, error: clientResult.error };
  }
  const client = clientResult.client;

  const runtimeResult = await findContextFromRuntimeState(client, normalizedToken);
  if (!runtimeResult.ok) {
    return { ok: false, status: 500, error: runtimeResult.error };
  }
  if (runtimeResult.data) {
    return { ok: true, data: shapeContextPayload({
      source: 'runtime_state',
      token: normalizedToken,
      invoice: runtimeResult.data.invoiceData,
      settings: runtimeResult.data.settings,
    }) };
  }

  const dbResult = await findContextFromDatabase(client, normalizedToken);
  if (!dbResult.ok) {
    return { ok: false, status: 500, error: dbResult.error };
  }
  if (dbResult.data) {
    return { ok: true, data: shapeContextPayload({
      source: 'database',
      token: normalizedToken,
      invoice: dbResult.data.invoiceData,
      settings: dbResult.data.settings,
    }) };
  }

  return { ok: false, status: 404, error: 'Payment link is invalid or has expired.' };
}

function validateSubmissionInput(input, context) {
  const payload = input && typeof input === 'object' ? input : {};
  const payerName = asString(payload.payerName);
  const payerEmail = asString(payload.payerEmail);
  const submittedReference = asString(payload.submittedReference);
  const note = asString(payload.note);
  const submittedPaymentDate = asString(payload.submittedPaymentDate);
  const submittedAmount = asNumber(payload.submittedAmount, 0);
  const proofFile = payload.proofFile && typeof payload.proofFile === 'object' ? payload.proofFile : null;

  if (!submittedPaymentDate) {
    return { ok: false, error: 'Payment date is required.' };
  }
  if (submittedAmount <= 0) {
    return { ok: false, error: 'Submitted amount must be greater than 0.' };
  }
  if (!proofFile) {
    return { ok: false, error: 'Proof of payment file is required.' };
  }

  const fileName = asString(proofFile.fileName);
  const mimeType = asString(proofFile.mimeType).toLowerCase();
  const sizeBytes = Math.floor(asNumber(proofFile.sizeBytes, 0));
  const dataUrl = asString(proofFile.dataUrl);

  if (!fileName || !mimeType || !sizeBytes || !dataUrl) {
    return { ok: false, error: 'Proof of payment file is incomplete.' };
  }

  const allowedMimeTypes = Array.isArray(context.settings.eftProofAllowedMimeTypes)
    ? context.settings.eftProofAllowedMimeTypes.map((entry) => asString(entry).toLowerCase()).filter(Boolean)
    : DEFAULT_SETTINGS.eftProofAllowedMimeTypes;
  if (!allowedMimeTypes.includes(mimeType)) {
    return { ok: false, error: `File type ${mimeType} is not allowed.` };
  }

  if (sizeBytes > context.settings.eftProofMaxFileSizeBytes) {
    return { ok: false, error: 'Proof file exceeds maximum allowed size.' };
  }

  if (submittedAmount * 100 > context.invoice.outstandingMinor + 1) {
    return { ok: false, error: 'Submitted amount exceeds invoice outstanding balance.' };
  }

  return {
    ok: true,
    data: {
      payerName: payerName || undefined,
      payerEmail: payerEmail || undefined,
      submittedReference: submittedReference || undefined,
      note: note || undefined,
      submittedPaymentDate,
      submittedAmountMinor: Math.round(submittedAmount * 100),
      proofFile: {
        id: generateId('popfile'),
        fileName,
        mimeType,
        sizeBytes,
        uploadedAt: new Date().toISOString(),
        dataUrl,
      },
    },
  };
}

async function submitToDatabase(client, context, payload) {
  const submittedAmount = Number((payload.submittedAmountMinor / 100).toFixed(2));
  const { data, error } = await client
    .from('invoice_payment_submissions')
    .insert({
      business_id: context.invoice.business_id,
      invoice_id: context.invoice.id,
      client_id: context.invoice.client_id,
      public_token: context.token,
      status: 'submitted',
      payer_name: payload.payerName,
      payer_email: payload.payerEmail,
      submitted_amount: submittedAmount,
      submitted_payment_date: payload.submittedPaymentDate,
      submitted_reference: payload.submittedReference,
      note: payload.note,
      proof_file_name: payload.proofFile.fileName,
      proof_file_mime_type: payload.proofFile.mimeType,
      proof_file_size_bytes: payload.proofFile.sizeBytes,
      proof_file_inline_data_url: payload.proofFile.dataUrl,
    })
    .select('id')
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id || generateId('popsub') };
}

async function submitToRuntimeState(client, context, payload) {
  const row = context.runtime;
  const state = row.state;
  const nowIso = new Date().toISOString();
  const submissionId = generateId('popsub');
  const invoice = context.invoice;
  const submissions = Array.isArray(state.paymentSubmissions) ? state.paymentSubmissions : [];
  const nextInvoiceActivity = Array.isArray(invoice.activityLog) ? invoice.activityLog.slice() : [];
  nextInvoiceActivity.push({
    id: generateId('invact'),
    event: 'payment_submission_created',
    at: nowIso,
    message: `Proof of payment submitted for ${invoice.invoiceNumber}.`,
  });

  const nextState = {
    ...state,
    paymentSubmissions: [
      {
        id: submissionId,
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        publicToken: context.token,
        status: 'submitted',
        payerName: payload.payerName,
        payerEmail: payload.payerEmail,
        submittedAmountMinor: payload.submittedAmountMinor,
        submittedPaymentDate: payload.submittedPaymentDate,
        submittedReference: payload.submittedReference,
        note: payload.note,
        proofFile: payload.proofFile,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      ...submissions,
    ],
    invoices: (Array.isArray(state.invoices) ? state.invoices : []).map((entry) =>
      entry?.id === invoice.id
        ? {
            ...entry,
            updatedAt: nowIso,
            activityLog: nextInvoiceActivity,
          }
        : entry,
    ),
  };

  const { error } = await client
    .from('runtime_app_states')
    .update({
      state_json: nextState,
      updated_at: nowIso,
      updated_by: row.userId || null,
    })
    .eq('user_id', row.userId)
    .eq('state_key', ACCOUNTING_STATE_KEY);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: submissionId };
}

async function resolveContextForSubmission(client, token) {
  const runtimeResult = await findContextFromRuntimeState(client, token);
  if (!runtimeResult.ok) return { ok: false, status: 500, error: runtimeResult.error };
  if (runtimeResult.data) {
    return {
      ok: true,
      data: {
        source: 'runtime_state',
        token,
        runtime: {
          userId: runtimeResult.data.userId,
          state: runtimeResult.data.state,
        },
        invoice: runtimeResult.data.invoice,
        invoiceData: runtimeResult.data.invoiceData,
        settings: runtimeResult.data.settings,
      },
    };
  }

  const dbResult = await findContextFromDatabase(client, token);
  if (!dbResult.ok) return { ok: false, status: 500, error: dbResult.error };
  if (!dbResult.data) {
    return { ok: false, status: 404, error: 'Payment link is invalid or has expired.' };
  }

  return {
    ok: true,
    data: {
      source: 'database',
      token,
      invoice: dbResult.data.invoice,
      invoiceData: dbResult.data.invoiceData,
      settings: dbResult.data.settings,
    },
  };
}

export async function submitPublicInvoicePaymentProof(token, input) {
  const normalizedToken = asString(token);
  if (!normalizedToken) {
    return { ok: false, status: 400, error: 'Payment token is required.' };
  }

  const clientResult = getSupabaseAdminClient();
  if (!clientResult.ok) {
    return { ok: false, status: 503, error: clientResult.error };
  }
  const client = clientResult.client;

  const contextResult = await resolveContextForSubmission(client, normalizedToken);
  if (!contextResult.ok) return contextResult;
  const context = contextResult.data;

  const eligibility = evaluatePublicEligibility({
    source: context.source,
    token: normalizedToken,
    invoice: context.invoiceData,
    settings: context.settings,
  });
  if (!eligibility.allowed) {
    return { ok: false, status: 409, error: eligibility.reason || 'Invoice is not eligible for submission.' };
  }

  const validation = validateSubmissionInput(input, {
    token: normalizedToken,
    source: context.source,
    invoice: context.invoiceData,
    settings: context.settings,
  });
  if (!validation.ok) {
    return { ok: false, status: 400, error: validation.error };
  }

  if (context.source === 'database') {
    const submitResult = await submitToDatabase(client, context, validation.data);
    if (!submitResult.ok) {
      return { ok: false, status: 500, error: submitResult.error || 'Unable to submit proof.' };
    }
    return {
      ok: true,
      data: {
        submissionId: submitResult.id,
      },
    };
  }

  const submitResult = await submitToRuntimeState(client, context, validation.data);
  if (!submitResult.ok) {
    return { ok: false, status: 500, error: submitResult.error || 'Unable to submit proof.' };
  }

  return {
    ok: true,
    data: {
      submissionId: submitResult.id,
    },
  };
}
