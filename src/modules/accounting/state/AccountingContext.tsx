import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { createSeedState } from '../data/seed';
import { LocalStorageAccountingRepository } from '../data/localStorageRepository';
import {
  AccountingState,
  Invoice,
  InvoiceActivityEvent,
  InvoiceAttachment,
  InvoiceFormValues,
  Payment,
  PaymentInput,
  Quote,
  QuoteActivityEvent,
  QuoteAttachment,
  QuoteComment,
  QuoteConversionPreferences,
  QuoteFormValues,
  RecurringInvoiceFrequency,
  RecurringInvoiceProfile,
  RecurringInvoiceStatus,
} from '../domain/types';
import { validateInvoiceForm, validatePaymentInput, validateQuoteForm } from '../domain/validation';
import { mapInvoiceItemsFormToDomain, mapQuoteItemsFormToDomain } from '../domain/mappers';
import { addDaysIsoDate, addRecurringIntervalIsoDate, todayIsoDate } from '../domain/date';
import { createId } from '../domain/id';
import { canConvertQuote, canEditQuote, canTransitionQuote } from '../domain/quote-rules';
import { canEditInvoice, canRecordPayment, canTransitionInvoice } from '../domain/invoice-rules';
import { convertQuoteToInvoice } from '../domain/conversion';
import { toMinor } from '../domain/money';
import { deriveInvoicePaymentSummary } from '../domain/calculations';
import { selectInvoiceById, selectInvoiceSummaries, selectQuoteById, selectQuoteSummaries } from '../domain/selectors';
import { useNotificationsContext } from '@/modules/notifications/state/NotificationsContext';
import { canUseSupabaseRuntimeState, loadRuntimeState, saveRuntimeState } from '@/lib/supabase/runtime-state';

interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

interface AccountingContextValue {
  state: AccountingState;
  quoteSummaries: ReturnType<typeof selectQuoteSummaries>;
  invoiceSummaries: ReturnType<typeof selectInvoiceSummaries>;
  recurringInvoiceProfiles: RecurringInvoiceProfile[];
  getQuoteById: (quoteId: string) => Quote | undefined;
  getInvoiceById: (invoiceId: string) => Invoice | undefined;
  getRecurringInvoiceProfileById: (profileId: string) => RecurringInvoiceProfile | undefined;
  getInvoicePayments: (invoiceId: string) => Payment[];
  getInvoicePaymentSummary: (invoiceId: string) => ReturnType<typeof deriveInvoicePaymentSummary> | undefined;
  createQuote: (values: QuoteFormValues) => ActionResult<Quote>;
  updateQuote: (quoteId: string, values: QuoteFormValues) => ActionResult<Quote>;
  duplicateQuote: (quoteId: string) => ActionResult<Quote>;
  transitionQuote: (quoteId: string, target: Quote['status'], note?: string) => ActionResult<Quote>;
  convertQuoteToInvoice: (
    quoteId: string,
    options?: Partial<QuoteConversionPreferences>,
  ) => ActionResult<Invoice>;
  deleteQuote: (quoteId: string) => ActionResult;
  addQuoteComment: (quoteId: string, body: string) => ActionResult<QuoteComment>;
  addQuoteAttachment: (
    quoteId: string,
    input: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      dataUrl?: string;
      storageKey?: string;
    },
  ) => ActionResult<QuoteAttachment>;
  removeQuoteAttachment: (quoteId: string, attachmentId: string) => ActionResult;
  updateQuoteConversionPreferences: (
    quoteId: string,
    options: Partial<QuoteConversionPreferences>,
  ) => ActionResult<Quote>;
  createInvoice: (values: InvoiceFormValues) => ActionResult<Invoice>;
  updateInvoice: (invoiceId: string, values: InvoiceFormValues) => ActionResult<Invoice>;
  duplicateInvoice: (invoiceId: string) => ActionResult<Invoice>;
  transitionInvoice: (invoiceId: string, target: Invoice['status'], note?: string) => ActionResult<Invoice>;
  recordPayment: (invoiceId: string, input: PaymentInput) => ActionResult;
  addInvoiceAttachment: (
    invoiceId: string,
    input: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      dataUrl?: string;
      storageKey?: string;
    },
  ) => ActionResult<InvoiceAttachment>;
  removeInvoiceAttachment: (invoiceId: string, attachmentId: string) => ActionResult;
  requestInvoiceRecurring: (invoiceId: string) => ActionResult<Invoice>;
  updateRecurringInvoiceProfile: (
    profileId: string,
    input: {
      profileName: string;
      frequency: RecurringInvoiceFrequency;
      interval: number;
      startDate: string;
      nextRunDate: string;
      endDate?: string;
      autoSend: boolean;
    },
  ) => ActionResult<RecurringInvoiceProfile>;
  setRecurringInvoiceProfileStatus: (
    profileId: string,
    status: RecurringInvoiceStatus,
  ) => ActionResult<RecurringInvoiceProfile>;
  deleteRecurringInvoiceProfile: (profileId: string) => ActionResult;
  requestInvoiceCreditNote: (invoiceId: string) => ActionResult<Invoice>;
  deleteInvoice: (invoiceId: string) => ActionResult;
}

const repository = new LocalStorageAccountingRepository();
const AccountingContext = createContext<AccountingContextValue | undefined>(undefined);
const REMOTE_STATE_KEY = 'accounting';

function isAccountingState(value: unknown): value is AccountingState {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<AccountingState>;
  return (
    Array.isArray(candidate.quotes) &&
    Array.isArray(candidate.invoices) &&
    Array.isArray(candidate.payments) &&
    (candidate.recurringInvoiceProfiles === undefined || Array.isArray(candidate.recurringInvoiceProfiles)) &&
    typeof candidate.quoteSequenceNext === 'number' &&
    typeof candidate.invoiceSequenceNext === 'number'
  );
}

function normalizeStateForConsumers(state: AccountingState): AccountingState {
  return {
    ...state,
    recurringInvoiceProfiles: state.recurringInvoiceProfiles ?? [],
  };
}

function createInitialState(): AccountingState {
  const loaded = repository.load();
  return isAccountingState(loaded) ? normalizeStateForConsumers(loaded) : createSeedState();
}

const DEFAULT_QUOTE_CONVERSION_PREFERENCES: QuoteConversionPreferences = {
  carryCustomerNotes: true,
  carryTermsAndConditions: true,
  carryAddresses: true,
};

function normalizeRecipientEmails(values?: string[]): string[] {
  if (!values) return [];
  const unique = new Set<string>();
  values.forEach((email) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    unique.add(trimmed);
  });
  return Array.from(unique);
}

function normalizeQuoteForConsumers(quote: Quote): Quote {
  return {
    ...quote,
    referenceNumber: quote.referenceNumber ?? '',
    salesperson: quote.salesperson ?? '',
    projectName: quote.projectName ?? '',
    subject: quote.subject ?? '',
    notes: quote.notes ?? '',
    termsAndConditions: quote.termsAndConditions ?? quote.paymentTerms ?? '',
    paymentTerms: quote.paymentTerms ?? '',
    internalMemo: quote.internalMemo ?? '',
    adjustmentMinor: quote.adjustmentMinor ?? 0,
    recipientEmails: quote.recipientEmails ?? [],
    comments: quote.comments ?? [],
    attachments: quote.attachments ?? [],
    activityLog: quote.activityLog ?? [],
    conversionPreferences: {
      ...DEFAULT_QUOTE_CONVERSION_PREFERENCES,
      ...(quote.conversionPreferences ?? {}),
    },
  };
}

function normalizeInvoiceForConsumers(invoice: Invoice): Invoice {
  return {
    ...invoice,
    orderNumber: invoice.orderNumber ?? '',
    accountsReceivableAccountId: invoice.accountsReceivableAccountId ?? '',
    salesperson: invoice.salesperson ?? '',
    subject: invoice.subject ?? '',
    terms: invoice.terms ?? 'custom',
    notes: invoice.notes ?? '',
    paymentTerms: invoice.paymentTerms ?? '',
    termsAndConditions: invoice.termsAndConditions ?? invoice.paymentTerms ?? '',
    internalMemo: invoice.internalMemo ?? '',
    recipientEmails: invoice.recipientEmails ?? [],
    attachments: invoice.attachments ?? [],
    activityLog: invoice.activityLog ?? [],
    adjustmentMinor: invoice.adjustmentMinor ?? 0,
  };
}

function createDefaultRecurringProfileFromInvoice(invoice: Invoice, nowIso: string): RecurringInvoiceProfile {
  const startDate = invoice.issueDate || todayIsoDate();
  return {
    id: createId('recurring'),
    sourceInvoiceId: invoice.id,
    sourceInvoiceNumber: invoice.invoiceNumber,
    clientId: invoice.clientId,
    profileName: `${invoice.invoiceNumber} Recurring`,
    frequency: 'monthly',
    interval: 1,
    startDate,
    nextRunDate: startDate,
    endDate: undefined,
    autoSend: false,
    status: 'draft',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function appendStatusEvent<
  TStatus extends string,
  TEntity extends { statusHistory: Array<{ id: string; status: TStatus; at: string; note?: string }> },
>(entity: TEntity, nextStatus: TStatus, nowIso: string, note?: string): TEntity {
  return {
    ...entity,
    statusHistory: [
      ...entity.statusHistory,
      {
        id: createId('status'),
        status: nextStatus,
        at: nowIso,
        note,
      },
    ],
  };
}

function summarizeValidationErrors(issues: Array<{ message: string }>): string {
  return issues.map((issue) => issue.message).join(' ');
}

function createQuoteActivityEvent(input: {
  event: QuoteActivityEvent['event'];
  at: string;
  message: string;
  actor?: string;
}): QuoteActivityEvent {
  return {
    id: createId('qevt'),
    event: input.event,
    at: input.at,
    actor: input.actor,
    message: input.message,
  };
}

function createInvoiceActivityEvent(input: {
  event: InvoiceActivityEvent['event'];
  at: string;
  message: string;
  actor?: string;
}): InvoiceActivityEvent {
  return {
    id: createId('ievt'),
    event: input.event,
    at: input.at,
    actor: input.actor,
    message: input.message,
  };
}

export function AccountingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountingState>(createInitialState);
  const notifications = useNotificationsContext();
  const [remoteHydrationComplete, setRemoteHydrationComplete] = useState(!canUseSupabaseRuntimeState());

  const commit = (updater: (previous: AccountingState) => AccountingState) => {
    setState((previous) => {
      const next = updater(previous);
      repository.save(next);
      return next;
    });
  };

  const quoteSummaries = useMemo(() => selectQuoteSummaries(state), [state]);
  const invoiceSummaries = useMemo(() => selectInvoiceSummaries(state), [state]);

  useEffect(() => {
    if (!canUseSupabaseRuntimeState()) return;

    let active = true;
    loadRuntimeState<AccountingState>(REMOTE_STATE_KEY).then((result) => {
      if (!active) return;
      if (result.ok && result.data && isAccountingState(result.data)) {
        setState(normalizeStateForConsumers(result.data));
      }
      setRemoteHydrationComplete(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!remoteHydrationComplete || !canUseSupabaseRuntimeState()) return;
    void saveRuntimeState(REMOTE_STATE_KEY, state);
  }, [remoteHydrationComplete, state]);

  const contextValue: AccountingContextValue = {
    state,
    quoteSummaries,
    invoiceSummaries,
    recurringInvoiceProfiles: (state.recurringInvoiceProfiles ?? []).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    getQuoteById: (quoteId) => {
      const quote = selectQuoteById(state, quoteId);
      return quote ? normalizeQuoteForConsumers(quote) : undefined;
    },
    getInvoiceById: (invoiceId) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return undefined;
      const normalized = normalizeInvoiceForConsumers(invoice);
      const paymentSummary = deriveInvoicePaymentSummary(normalized, state.payments);
      return {
        ...normalized,
        status: paymentSummary.derivedStatus,
      };
    },
    getRecurringInvoiceProfileById: (profileId) =>
      (state.recurringInvoiceProfiles ?? []).find((profile) => profile.id === profileId),
    getInvoicePayments: (invoiceId) =>
      state.payments
        .filter((payment) => payment.invoiceId === invoiceId)
        .slice()
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)),
    getInvoicePaymentSummary: (invoiceId) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return undefined;
      return deriveInvoicePaymentSummary(invoice, state.payments);
    },
    createQuote: (values) => {
      const validation = validateQuoteForm(values);
      if (!validation.isValid) {
        return { ok: false, error: summarizeValidationErrors(validation.issues) };
      }

      const nowIso = new Date().toISOString();
      let createdQuote: Quote | undefined;

      commit((previous) => {
        const quoteId = createId('quote');
        const generatedQuoteNumber = `QUO-${String(previous.quoteSequenceNext).padStart(5, '0')}`;
        const requestedQuoteNumber = values.quoteNumber?.trim();
        const quoteNumber =
          requestedQuoteNumber && !previous.quotes.some((entry) => entry.quoteNumber === requestedQuoteNumber)
            ? requestedQuoteNumber
            : generatedQuoteNumber;

        createdQuote = normalizeQuoteForConsumers({
          id: quoteId,
          quoteNumber,
          referenceNumber: values.referenceNumber?.trim() || undefined,
          salesperson: values.salesperson?.trim() || undefined,
          projectName: values.projectName?.trim() || undefined,
          subject: values.subject?.trim() || undefined,
          clientId: values.clientId,
          issueDate: values.issueDate,
          expiryDate: values.expiryDate,
          currencyCode: 'ZAR',
          status: 'draft',
          templateId: values.templateId,
          templateVersionId: values.templateVersionId,
          templateName: values.templateName,
          notes: values.notes,
          termsAndConditions: values.termsAndConditions ?? values.paymentTerms,
          paymentTerms: values.paymentTerms,
          internalMemo: values.internalMemo,
          adjustmentMinor: toMinor(values.adjustment ?? 0),
          recipientEmails: normalizeRecipientEmails(values.recipientEmails),
          billingAddressSnapshot: values.billingAddressSnapshot,
          shippingAddressSnapshot: values.shippingAddressSnapshot,
          comments: [],
          attachments: values.attachments ?? [],
          activityLog: [
            createQuoteActivityEvent({
              event: 'created',
              at: nowIso,
              message: `Quote ${quoteNumber} created.`,
            }),
          ],
          conversionPreferences: { ...DEFAULT_QUOTE_CONVERSION_PREFERENCES },
          items: mapQuoteItemsFormToDomain(values.items),
          documentDiscountPercent: values.documentDiscountPercent,
          createdAt: nowIso,
          updatedAt: nowIso,
          statusHistory: [
            {
              id: createId('status'),
              status: 'draft',
              at: nowIso,
            },
          ],
        });

        return {
          ...previous,
          quotes: [createdQuote, ...previous.quotes],
          quoteSequenceNext: previous.quoteSequenceNext + 1,
        };
      });

      return createdQuote
        ? (() => {
            notifications.notify({
              level: 'success',
              source: 'quotes',
              title: 'Quote Draft Created',
              message: `${createdQuote.quoteNumber} has been created.`,
              persistent: false,
              toast: true,
              route: `/quotes/${createdQuote.id}`,
            });
            return { ok: true, data: createdQuote };
          })()
        : { ok: false, error: 'Unable to create quote.' };
    },
    updateQuote: (quoteId, values) => {
      const quote = selectQuoteById(state, quoteId);
      if (!quote) return { ok: false, error: 'Quote not found.' };

      const editable = canEditQuote(quote.status);
      if (!editable.allowed) return { ok: false, error: editable.reason };

      const validation = validateQuoteForm(values);
      if (!validation.isValid) {
        return { ok: false, error: summarizeValidationErrors(validation.issues) };
      }

      const nowIso = new Date().toISOString();
      const nextQuote = normalizeQuoteForConsumers({
        ...quote,
        referenceNumber: values.referenceNumber?.trim() || undefined,
        salesperson: values.salesperson?.trim() || undefined,
        projectName: values.projectName?.trim() || undefined,
        subject: values.subject?.trim() || undefined,
        clientId: values.clientId,
        issueDate: values.issueDate,
        expiryDate: values.expiryDate,
        templateId: values.templateId,
        templateVersionId: values.templateVersionId,
        templateName: values.templateName,
        notes: values.notes,
        termsAndConditions: values.termsAndConditions ?? values.paymentTerms,
        paymentTerms: values.paymentTerms,
        internalMemo: values.internalMemo,
        adjustmentMinor: toMinor(values.adjustment ?? 0),
        recipientEmails: normalizeRecipientEmails(values.recipientEmails),
        billingAddressSnapshot: values.billingAddressSnapshot,
        shippingAddressSnapshot: values.shippingAddressSnapshot,
        attachments: values.attachments ?? quote.attachments ?? [],
        documentDiscountPercent: values.documentDiscountPercent,
        items: mapQuoteItemsFormToDomain(values.items),
        updatedAt: nowIso,
        activityLog: [
          ...(quote.activityLog ?? []),
          createQuoteActivityEvent({
            event: 'updated',
            at: nowIso,
            message: `Quote ${quote.quoteNumber} updated.`,
          }),
        ],
      });

      commit((previous) => ({
        ...previous,
        quotes: previous.quotes.map((entry) => (entry.id === quoteId ? nextQuote : entry)),
      }));

      notifications.notify({
        level: 'success',
        source: 'quotes',
        title: 'Quote Draft Saved',
        message: `${nextQuote.quoteNumber} was updated.`,
        persistent: false,
        toast: true,
        route: `/quotes/${nextQuote.id}`,
      });

      return { ok: true, data: nextQuote };
    },
    duplicateQuote: (quoteId) => {
      const source = selectQuoteById(state, quoteId);
      if (!source) return { ok: false, error: 'Quote not found.' };

      const nowIso = new Date().toISOString();
      const issueDate = todayIsoDate();
      let duplicateQuote: Quote | undefined;

      commit((previous) => {
        const nextId = createId('quote');
        const nextNumber = `QUO-${String(previous.quoteSequenceNext).padStart(5, '0')}`;

        duplicateQuote = normalizeQuoteForConsumers({
          ...source,
          id: nextId,
          quoteNumber: nextNumber,
          status: 'draft',
          issueDate,
          expiryDate: addDaysIsoDate(issueDate, 14),
          createdAt: nowIso,
          updatedAt: nowIso,
          sentAt: undefined,
          viewedAt: undefined,
          acceptedAt: undefined,
          rejectedAt: undefined,
          rejectionReason: undefined,
          convertedInvoiceId: undefined,
          comments: [],
          attachments: [],
          activityLog: [
            createQuoteActivityEvent({
              event: 'duplicated',
              at: nowIso,
              message: `Duplicated from ${source.quoteNumber} into ${nextNumber}.`,
            }),
          ],
          statusHistory: [
            {
              id: createId('status'),
              status: 'draft',
              at: nowIso,
              note: `Duplicated from ${source.quoteNumber}`,
            },
          ],
          items: source.items.map((item, index) => ({
            ...item,
            id: `${nextId}_item_${index + 1}`,
            position: index + 1,
          })),
        });

        return {
          ...previous,
          quotes: [duplicateQuote, ...previous.quotes],
          quoteSequenceNext: previous.quoteSequenceNext + 1,
        };
      });

      return duplicateQuote
        ? (() => {
            notifications.notify({
              level: 'info',
              source: 'quotes',
              title: 'Quote Duplicated',
              message: `${source.quoteNumber} was copied to ${duplicateQuote.quoteNumber}.`,
              persistent: false,
              toast: true,
              route: `/quotes/${duplicateQuote.id}/edit`,
            });
            return { ok: true, data: duplicateQuote };
          })()
        : { ok: false, error: 'Unable to duplicate quote.' };
    },
    transitionQuote: (quoteId, target, note) => {
      const quote = selectQuoteById(state, quoteId);
      if (!quote) return { ok: false, error: 'Quote not found.' };

      const transition = canTransitionQuote(quote.status, target);
      if (!transition.allowed) return { ok: false, error: transition.reason };

      const nowIso = new Date().toISOString();
      let nextQuote: Quote = {
        ...quote,
        status: target,
        updatedAt: nowIso,
      };

      if (target === 'sent') nextQuote.sentAt = nowIso;
      if (target === 'viewed') nextQuote.viewedAt = nowIso;
      if (target === 'accepted') nextQuote.acceptedAt = nowIso;
      if (target === 'rejected') {
        nextQuote.rejectedAt = nowIso;
        nextQuote.rejectionReason = note;
      }

      nextQuote = appendStatusEvent(nextQuote, target, nowIso, note);
      nextQuote = {
        ...nextQuote,
        activityLog: [
          ...(nextQuote.activityLog ?? []),
          createQuoteActivityEvent({
            event: 'status_changed',
            at: nowIso,
            message: `Status changed to ${target.replace('_', ' ')}.`,
          }),
        ],
      };

      commit((previous) => ({
        ...previous,
        quotes: previous.quotes.map((entry) => (entry.id === quoteId ? nextQuote : entry)),
      }));

      notifications.notify({
        level:
          target === 'accepted'
            ? 'success'
            : target === 'rejected' || target === 'expired'
              ? 'warning'
              : 'info',
        source: 'quotes',
        title: `Quote ${target.charAt(0).toUpperCase() + target.slice(1)}`,
        message: `${quote.quoteNumber} is now ${target.replace('_', ' ')}.`,
        persistent: target === 'accepted' || target === 'rejected' || target === 'expired',
        toast: true,
        route: `/quotes/${quote.id}`,
        relatedEntityType: 'quote',
        relatedEntityId: quote.id,
        dedupeKey: `quote:${quote.id}:status:${target}`,
      });

      return { ok: true, data: nextQuote };
    },
    convertQuoteToInvoice: (quoteId, options) => {
      const quote = selectQuoteById(state, quoteId);
      if (!quote) return { ok: false, error: 'Quote not found.' };

      const conversion = canConvertQuote(quote.status);
      if (!conversion.allowed) return { ok: false, error: conversion.reason };

      const nowIso = new Date().toISOString();
      let createdInvoice: Invoice | undefined;

      commit((previous) => {
        const invoiceId = createId('invoice');
        const invoiceNumber = `INV-${String(previous.invoiceSequenceNext).padStart(5, '0')}`;
        const preferences = {
          ...DEFAULT_QUOTE_CONVERSION_PREFERENCES,
          ...(quote.conversionPreferences ?? {}),
          ...(options ?? {}),
        };

        createdInvoice = convertQuoteToInvoice({
          quote,
          invoiceId,
          invoiceNumber,
          nowIso,
          dueDate: addDaysIsoDate(todayIsoDate(), 14),
          options: preferences,
        });

        const convertedQuote: Quote = {
          ...quote,
          status: 'converted',
          convertedInvoiceId: invoiceId,
          conversionPreferences: preferences,
          updatedAt: nowIso,
          activityLog: [
            ...(quote.activityLog ?? []),
            createQuoteActivityEvent({
              event: 'converted',
              at: nowIso,
              message: `Converted to invoice ${invoiceNumber}.`,
              }),
            ],
          statusHistory: [
            ...quote.statusHistory,
            {
              id: createId('status'),
              status: 'converted',
              at: nowIso,
              note: `Converted to ${invoiceNumber}`,
            },
          ],
        };

        return {
          ...previous,
          invoices: [createdInvoice, ...previous.invoices],
          quotes: previous.quotes.map((entry) => (entry.id === quoteId ? convertedQuote : entry)),
          invoiceSequenceNext: previous.invoiceSequenceNext + 1,
        };
      });

      return createdInvoice
        ? (() => {
            notifications.notify({
              level: 'success',
              source: 'quotes',
              title: 'Quote Converted',
              message: `${quote.quoteNumber} was converted to ${createdInvoice.invoiceNumber}.`,
              persistent: true,
              toast: true,
              route: `/invoices/${createdInvoice.id}`,
              relatedEntityType: 'invoice',
              relatedEntityId: createdInvoice.id,
              dedupeKey: `quote:${quote.id}:converted:${createdInvoice.id}`,
              dedupeWindowMs: 90_000,
            });
            return { ok: true, data: createdInvoice };
          })()
        : { ok: false, error: 'Unable to convert quote.' };
    },
    deleteQuote: (quoteId) => {
      const quote = selectQuoteById(state, quoteId);
      if (!quote) return { ok: false, error: 'Quote not found.' };
      if (quote.status === 'converted') {
        return { ok: false, error: 'Converted quotes cannot be deleted.' };
      }

      commit((previous) => ({
        ...previous,
        quotes: previous.quotes.filter((entry) => entry.id !== quoteId),
      }));

      notifications.notify({
        level: 'warning',
        source: 'quotes',
        title: 'Quote Deleted',
        message: `${quote.quoteNumber} has been deleted.`,
        persistent: true,
        toast: true,
        route: '/quotes',
        dedupeKey: `quote:${quoteId}:deleted`,
      });

      return { ok: true };
    },
    addQuoteComment: (quoteId, body) => {
      const quote = selectQuoteById(state, quoteId);
      if (!quote) return { ok: false, error: 'Quote not found.' };
      const trimmedBody = body.trim();
      if (!trimmedBody) return { ok: false, error: 'Comment cannot be empty.' };

      const nowIso = new Date().toISOString();
      const comment: QuoteComment = {
        id: createId('qcom'),
        body: trimmedBody,
        createdAt: nowIso,
      };

      commit((previous) => ({
        ...previous,
        quotes: previous.quotes.map((entry) =>
          entry.id === quoteId
            ? {
                ...entry,
                updatedAt: nowIso,
                comments: [comment, ...(entry.comments ?? [])],
                activityLog: [
                  ...(entry.activityLog ?? []),
                  createQuoteActivityEvent({
                    event: 'comment_added',
                    at: nowIso,
                    message: 'Comment added.',
                  }),
                ],
              }
            : entry,
        ),
      }));

      return { ok: true, data: comment };
    },
    addQuoteAttachment: (quoteId, input) => {
      const quote = selectQuoteById(state, quoteId);
      if (!quote) return { ok: false, error: 'Quote not found.' };
      if (!input.fileName.trim()) return { ok: false, error: 'File name is required.' };
      if (input.sizeBytes <= 0) return { ok: false, error: 'Attachment size must be greater than zero.' };

      const nowIso = new Date().toISOString();
      const attachment: QuoteAttachment = {
        id: createId('qatt'),
        fileName: input.fileName.trim(),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        dataUrl: input.dataUrl,
        storageKey: input.storageKey,
        createdAt: nowIso,
      };

      commit((previous) => ({
        ...previous,
        quotes: previous.quotes.map((entry) =>
          entry.id === quoteId
            ? {
                ...entry,
                updatedAt: nowIso,
                attachments: [attachment, ...(entry.attachments ?? [])],
                activityLog: [
                  ...(entry.activityLog ?? []),
                  createQuoteActivityEvent({
                    event: 'attachment_added',
                    at: nowIso,
                    message: `Attachment added: ${attachment.fileName}.`,
                  }),
                ],
              }
            : entry,
        ),
      }));

      return { ok: true, data: attachment };
    },
    removeQuoteAttachment: (quoteId, attachmentId) => {
      const quote = selectQuoteById(state, quoteId);
      if (!quote) return { ok: false, error: 'Quote not found.' };
      const attachment = (quote.attachments ?? []).find((entry) => entry.id === attachmentId);
      if (!attachment) return { ok: false, error: 'Attachment not found.' };

      const nowIso = new Date().toISOString();

      commit((previous) => ({
        ...previous,
        quotes: previous.quotes.map((entry) =>
          entry.id === quoteId
            ? {
                ...entry,
                updatedAt: nowIso,
                attachments: (entry.attachments ?? []).filter((item) => item.id !== attachmentId),
                activityLog: [
                  ...(entry.activityLog ?? []),
                  createQuoteActivityEvent({
                    event: 'attachment_removed',
                    at: nowIso,
                    message: `Attachment removed: ${attachment.fileName}.`,
                  }),
                ],
              }
            : entry,
        ),
      }));

      return { ok: true };
    },
    updateQuoteConversionPreferences: (quoteId, options) => {
      const quote = selectQuoteById(state, quoteId);
      if (!quote) return { ok: false, error: 'Quote not found.' };

      const nowIso = new Date().toISOString();
      const nextQuote = normalizeQuoteForConsumers({
        ...quote,
        updatedAt: nowIso,
        conversionPreferences: {
          ...DEFAULT_QUOTE_CONVERSION_PREFERENCES,
          ...(quote.conversionPreferences ?? {}),
          ...options,
        },
      });

      commit((previous) => ({
        ...previous,
        quotes: previous.quotes.map((entry) => (entry.id === quoteId ? nextQuote : entry)),
      }));

      return { ok: true, data: nextQuote };
    },
    createInvoice: (values) => {
      const validation = validateInvoiceForm(values);
      if (!validation.isValid) {
        return { ok: false, error: summarizeValidationErrors(validation.issues) };
      }

      const nowIso = new Date().toISOString();
      let createdInvoice: Invoice | undefined;

      commit((previous) => {
        const invoiceId = createId('invoice');
        const generatedInvoiceNumber = `INV-${String(previous.invoiceSequenceNext).padStart(5, '0')}`;
        const requestedInvoiceNumber = values.invoiceNumber?.trim();
        const invoiceNumber =
          requestedInvoiceNumber && !previous.invoices.some((entry) => entry.invoiceNumber === requestedInvoiceNumber)
            ? requestedInvoiceNumber
            : generatedInvoiceNumber;

        createdInvoice = normalizeInvoiceForConsumers({
          id: invoiceId,
          invoiceNumber,
          orderNumber: values.orderNumber?.trim() || undefined,
          accountsReceivableAccountId: values.accountsReceivableAccountId?.trim() || undefined,
          salesperson: values.salesperson?.trim() || undefined,
          subject: values.subject?.trim() || undefined,
          clientId: values.clientId,
          issueDate: values.issueDate,
          dueDate: values.dueDate,
          terms: values.terms,
          currencyCode: 'ZAR',
          status: 'draft',
          templateId: values.templateId,
          templateVersionId: values.templateVersionId,
          templateName: values.templateName,
          notes: values.notes,
          paymentTerms: values.paymentTerms || values.terms,
          termsAndConditions: values.termsAndConditions ?? values.paymentTerms ?? values.terms,
          internalMemo: values.internalMemo,
          recipientEmails: normalizeRecipientEmails(values.recipientEmails),
          billingAddressSnapshot: values.billingAddressSnapshot,
          shippingAddressSnapshot: values.shippingAddressSnapshot,
          attachments: values.attachments ?? [],
          activityLog: [
            createInvoiceActivityEvent({
              event: 'created',
              at: nowIso,
              message: `Invoice ${invoiceNumber} created.`,
            }),
          ],
          items: mapInvoiceItemsFormToDomain(values.items),
          adjustmentMinor: toMinor(values.adjustment ?? 0),
          documentDiscountPercent: values.documentDiscountPercent,
          createdAt: nowIso,
          updatedAt: nowIso,
          statusHistory: [
            {
              id: createId('status'),
              status: 'draft',
              at: nowIso,
            },
          ],
        });

        return {
          ...previous,
          invoices: [createdInvoice, ...previous.invoices],
          invoiceSequenceNext: previous.invoiceSequenceNext + 1,
        };
      });

      return createdInvoice
        ? (() => {
            notifications.notify({
              level: 'success',
              source: 'invoices',
              title: 'Invoice Draft Created',
              message: `${createdInvoice.invoiceNumber} has been created.`,
              persistent: false,
              toast: true,
              route: `/invoices/${createdInvoice.id}`,
            });
            return { ok: true, data: createdInvoice };
          })()
        : { ok: false, error: 'Unable to create invoice.' };
    },
    updateInvoice: (invoiceId, values) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };

      const summary = deriveInvoicePaymentSummary(normalizeInvoiceForConsumers(invoice), state.payments);
      const editable = canEditInvoice(summary.derivedStatus);
      if (!editable.allowed) return { ok: false, error: editable.reason };

      const validation = validateInvoiceForm(values);
      if (!validation.isValid) {
        return { ok: false, error: summarizeValidationErrors(validation.issues) };
      }

      const nowIso = new Date().toISOString();
      const nextInvoice: Invoice = normalizeInvoiceForConsumers({
        ...invoice,
        orderNumber: values.orderNumber?.trim() || undefined,
        accountsReceivableAccountId: values.accountsReceivableAccountId?.trim() || undefined,
        salesperson: values.salesperson?.trim() || undefined,
        subject: values.subject?.trim() || undefined,
        clientId: values.clientId,
        issueDate: values.issueDate,
        dueDate: values.dueDate,
        terms: values.terms,
        templateId: values.templateId,
        templateVersionId: values.templateVersionId,
        templateName: values.templateName,
        notes: values.notes,
        paymentTerms: values.paymentTerms || values.terms,
        termsAndConditions: values.termsAndConditions ?? values.paymentTerms ?? values.terms,
        internalMemo: values.internalMemo,
        recipientEmails: normalizeRecipientEmails(values.recipientEmails),
        billingAddressSnapshot: values.billingAddressSnapshot,
        shippingAddressSnapshot: values.shippingAddressSnapshot,
        attachments: values.attachments ?? invoice.attachments ?? [],
        documentDiscountPercent: values.documentDiscountPercent,
        adjustmentMinor: toMinor(values.adjustment ?? 0),
        items: mapInvoiceItemsFormToDomain(values.items),
        updatedAt: nowIso,
        activityLog: [
          ...(invoice.activityLog ?? []),
          createInvoiceActivityEvent({
            event: 'updated',
            at: nowIso,
            message: `Invoice ${invoice.invoiceNumber} updated.`,
          }),
        ],
      });

      commit((previous) => ({
        ...previous,
        invoices: previous.invoices.map((entry) => (entry.id === invoiceId ? nextInvoice : entry)),
      }));

      notifications.notify({
        level: 'success',
        source: 'invoices',
        title: 'Invoice Draft Saved',
        message: `${nextInvoice.invoiceNumber} was updated.`,
        persistent: false,
        toast: true,
        route: `/invoices/${nextInvoice.id}`,
      });

      return { ok: true, data: nextInvoice };
    },
    duplicateInvoice: (invoiceId) => {
      const source = selectInvoiceById(state, invoiceId);
      if (!source) return { ok: false, error: 'Invoice not found.' };

      const nowIso = new Date().toISOString();
      const issueDate = todayIsoDate();
      let duplicateInvoice: Invoice | undefined;

      commit((previous) => {
        const nextId = createId('invoice');
        const nextNumber = `INV-${String(previous.invoiceSequenceNext).padStart(5, '0')}`;

        duplicateInvoice = normalizeInvoiceForConsumers({
          ...source,
          id: nextId,
          invoiceNumber: nextNumber,
          orderNumber: undefined,
          status: 'draft',
          issueDate,
          dueDate: addDaysIsoDate(issueDate, 14),
          terms: 'custom',
          sourceQuoteId: undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
          sentAt: undefined,
          voidedAt: undefined,
          approvedAt: undefined,
          attachments: [],
          activityLog: [
            createInvoiceActivityEvent({
              event: 'duplicated',
              at: nowIso,
              message: `Duplicated from ${source.invoiceNumber} into ${nextNumber}.`,
            }),
          ],
          statusHistory: [
            {
              id: createId('status'),
              status: 'draft',
              at: nowIso,
              note: `Duplicated from ${source.invoiceNumber}`,
            },
          ],
          items: source.items.map((item, index) => ({
            ...item,
            id: `${nextId}_item_${index + 1}`,
            position: index + 1,
          })),
        });

        return {
          ...previous,
          invoices: [duplicateInvoice, ...previous.invoices],
          invoiceSequenceNext: previous.invoiceSequenceNext + 1,
        };
      });

      return duplicateInvoice
        ? (() => {
            notifications.notify({
              level: 'info',
              source: 'invoices',
              title: 'Invoice Duplicated',
              message: `${source.invoiceNumber} was copied to ${duplicateInvoice.invoiceNumber}.`,
              persistent: false,
              toast: true,
              route: `/invoices/${duplicateInvoice.id}/edit`,
            });
            return { ok: true, data: duplicateInvoice };
          })()
        : { ok: false, error: 'Unable to duplicate invoice.' };
    },
    transitionInvoice: (invoiceId, target, note) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };

      const currentStatus = deriveInvoicePaymentSummary(normalizeInvoiceForConsumers(invoice), state.payments).derivedStatus;
      const transition = canTransitionInvoice(currentStatus, target);
      if (!transition.allowed) return { ok: false, error: transition.reason };

      const nowIso = new Date().toISOString();
      let nextInvoice: Invoice = normalizeInvoiceForConsumers({
        ...invoice,
        status: target,
        updatedAt: nowIso,
      });

      if (target === 'sent') nextInvoice.sentAt = nowIso;
      if (target === 'approved') nextInvoice.approvedAt = nowIso;
      if (target === 'void') nextInvoice.voidedAt = nowIso;

      nextInvoice = appendStatusEvent(nextInvoice, target, nowIso, note);
      nextInvoice = {
        ...nextInvoice,
        activityLog: [
          ...(nextInvoice.activityLog ?? []),
          createInvoiceActivityEvent({
            event: target === 'void' ? 'voided' : 'status_changed',
            at: nowIso,
            message: `Status changed to ${target.replace('_', ' ')}${note ? ` · ${note}` : ''}.`,
          }),
        ],
      };

      commit((previous) => ({
        ...previous,
        invoices: previous.invoices.map((entry) => (entry.id === invoiceId ? nextInvoice : entry)),
      }));

      notifications.notify({
        level: target === 'void' ? 'warning' : 'info',
        source: 'invoices',
        title: target === 'void' ? 'Invoice Voided' : `Invoice ${target === 'approved' ? 'Opened' : 'Sent'}`,
        message: `${invoice.invoiceNumber} is now ${target === 'approved' ? 'open' : target}.`,
        persistent: target === 'void' || target === 'sent',
        toast: true,
        route: `/invoices/${invoice.id}`,
        relatedEntityType: 'invoice',
        relatedEntityId: invoice.id,
        dedupeKey: `invoice:${invoice.id}:status:${target}`,
      });

      return { ok: true, data: nextInvoice };
    },
    recordPayment: (invoiceId, input) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };

      const currentSummary = deriveInvoicePaymentSummary(normalizeInvoiceForConsumers(invoice), state.payments);
      const paymentAllowed = canRecordPayment(currentSummary.derivedStatus);
      if (!paymentAllowed.allowed) return { ok: false, error: paymentAllowed.reason };

      const validation = validatePaymentInput(input, currentSummary.outstandingMinor / 100);
      if (!validation.isValid) {
        return { ok: false, error: summarizeValidationErrors(validation.issues) };
      }

      const nowIso = new Date().toISOString();
      const payment: Payment = {
        id: createId('payment'),
        invoiceId,
        amountMinor: toMinor(input.amount),
        paymentDate: input.paymentDate,
        method: input.method,
        reference: input.reference,
        note: input.note,
        createdAt: nowIso,
      };

      const nextPayments = [payment, ...state.payments];
      const nextSummary = deriveInvoicePaymentSummary(normalizeInvoiceForConsumers(invoice), nextPayments);

      let nextInvoice: Invoice = normalizeInvoiceForConsumers({
        ...invoice,
        status: nextSummary.derivedStatus,
        updatedAt: nowIso,
        activityLog: [
          ...(invoice.activityLog ?? []),
          createInvoiceActivityEvent({
            event: 'payment_recorded',
            at: nowIso,
            message: `Payment recorded: ${input.amount.toFixed(2)}.`,
          }),
        ],
      });

      if (nextSummary.derivedStatus !== invoice.status) {
        nextInvoice = appendStatusEvent(
          nextInvoice,
          nextSummary.derivedStatus,
          nowIso,
          `Payment recorded: ${input.amount.toFixed(2)}`,
        );
      }

      const becamePaid = nextSummary.derivedStatus === 'paid' && currentSummary.derivedStatus !== 'paid';
      let advancedRecurringProfiles: Array<{ id: string; name: string; nextRunDate: string }> = [];

      commit((previous) => ({
        ...previous,
        payments: [payment, ...previous.payments],
        invoices: previous.invoices.map((entry) => (entry.id === invoiceId ? nextInvoice : entry)),
        recurringInvoiceProfiles: becamePaid
          ? (previous.recurringInvoiceProfiles ?? []).map((profile) => {
              if (profile.sourceInvoiceId !== invoiceId) return profile;
              const baseDate = profile.nextRunDate > invoice.issueDate ? profile.nextRunDate : invoice.issueDate;
              const nextRunDate = addRecurringIntervalIsoDate(baseDate, profile.frequency, profile.interval);
              advancedRecurringProfiles = [
                ...advancedRecurringProfiles,
                {
                  id: profile.id,
                  name: profile.profileName,
                  nextRunDate,
                },
              ];
              return {
                ...profile,
                nextRunDate,
                status: profile.status === 'draft' ? 'active' : profile.status,
                updatedAt: nowIso,
              };
            })
          : previous.recurringInvoiceProfiles,
      }));

      notifications.notify({
        level: 'success',
        source: 'payments',
        title: 'Payment Recorded',
        message: `${input.amount.toFixed(2)} was applied to ${invoice.invoiceNumber}.`,
        persistent: true,
        toast: true,
        route: `/invoices/${invoice.id}`,
        relatedEntityType: 'invoice',
        relatedEntityId: invoice.id,
        dedupeKey: `payment:${payment.id}`,
      });

      if (nextSummary.derivedStatus === 'paid') {
        notifications.notify({
          level: 'success',
          source: 'invoices',
          title: 'Invoice Paid',
          message: `${invoice.invoiceNumber} is fully settled.`,
          persistent: true,
          toast: true,
          route: `/invoices/${invoice.id}`,
          relatedEntityType: 'invoice',
          relatedEntityId: invoice.id,
          dedupeKey: `invoice:${invoice.id}:paid`,
        });

        if (advancedRecurringProfiles.length > 0) {
          const primaryProfile = advancedRecurringProfiles[0];
          notifications.notify({
            level: 'info',
            source: 'invoices',
            title: 'Recurring Schedule Updated',
            message:
              advancedRecurringProfiles.length === 1
                ? `${primaryProfile.name} moved to next run date ${primaryProfile.nextRunDate}.`
                : `${advancedRecurringProfiles.length} recurring profiles moved to their next run dates.`,
            persistent: false,
            toast: true,
            route: `/invoices/recurring?invoiceId=${invoice.id}`,
            dedupeKey: `invoice:${invoice.id}:recurring-next-run`,
          });
        }
      }

      return { ok: true };
    },
    addInvoiceAttachment: (invoiceId, input) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };
      if (!input.fileName.trim()) return { ok: false, error: 'File name is required.' };
      if (input.sizeBytes <= 0) return { ok: false, error: 'Attachment size must be greater than zero.' };

      const nowIso = new Date().toISOString();
      const attachment: InvoiceAttachment = {
        id: createId('iatt'),
        fileName: input.fileName.trim(),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        dataUrl: input.dataUrl,
        storageKey: input.storageKey,
        createdAt: nowIso,
      };

      commit((previous) => ({
        ...previous,
        invoices: previous.invoices.map((entry) =>
          entry.id === invoiceId
            ? normalizeInvoiceForConsumers({
                ...entry,
                updatedAt: nowIso,
                attachments: [attachment, ...(entry.attachments ?? [])],
                activityLog: [
                  ...(entry.activityLog ?? []),
                  createInvoiceActivityEvent({
                    event: 'attachment_added',
                    at: nowIso,
                    message: `Attachment added: ${attachment.fileName}.`,
                  }),
                ],
              })
            : entry,
        ),
      }));

      return { ok: true, data: attachment };
    },
    removeInvoiceAttachment: (invoiceId, attachmentId) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };
      const attachment = (invoice.attachments ?? []).find((entry) => entry.id === attachmentId);
      if (!attachment) return { ok: false, error: 'Attachment not found.' };

      const nowIso = new Date().toISOString();
      commit((previous) => ({
        ...previous,
        invoices: previous.invoices.map((entry) =>
          entry.id === invoiceId
            ? normalizeInvoiceForConsumers({
                ...entry,
                updatedAt: nowIso,
                attachments: (entry.attachments ?? []).filter((item) => item.id !== attachmentId),
                activityLog: [
                  ...(entry.activityLog ?? []),
                  createInvoiceActivityEvent({
                    event: 'attachment_removed',
                    at: nowIso,
                    message: `Attachment removed: ${attachment.fileName}.`,
                  }),
                ],
              })
            : entry,
        ),
      }));
      return { ok: true };
    },
    requestInvoiceRecurring: (invoiceId) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };
      if (invoice.status === 'void') {
        return { ok: false, error: 'Voided invoices cannot be converted to recurring profiles.' };
      }

      const nowIso = new Date().toISOString();
      const nextInvoice = normalizeInvoiceForConsumers({
        ...invoice,
        updatedAt: nowIso,
        activityLog: [
          ...(invoice.activityLog ?? []),
          createInvoiceActivityEvent({
            event: 'recurring_requested',
            at: nowIso,
            message: 'Recurring invoice setup requested from invoice detail.',
          }),
        ],
      });

      const existingProfile = (state.recurringInvoiceProfiles ?? []).find(
        (profile) => profile.sourceInvoiceId === invoice.id,
      );
      const nextProfile =
        existingProfile
          ? {
              ...existingProfile,
              updatedAt: nowIso,
            }
          : createDefaultRecurringProfileFromInvoice(invoice, nowIso);

      commit((previous) => ({
        ...previous,
        invoices: previous.invoices.map((entry) => (entry.id === invoiceId ? nextInvoice : entry)),
        recurringInvoiceProfiles: existingProfile
          ? (previous.recurringInvoiceProfiles ?? []).map((entry) =>
              entry.id === existingProfile.id ? nextProfile : entry,
            )
          : [nextProfile, ...(previous.recurringInvoiceProfiles ?? [])],
      }));

      notifications.notify({
        level: 'info',
        source: 'invoices',
        title: 'Recurring Invoice Profile Ready',
        message: `Recurring profile is ready for ${invoice.invoiceNumber}.`,
        persistent: false,
        toast: true,
        route: '/invoices/recurring',
        dedupeKey: `invoice:${invoice.id}:recurring`,
      });

      return { ok: true, data: nextInvoice };
    },
    updateRecurringInvoiceProfile: (profileId, input) => {
      const profile = (state.recurringInvoiceProfiles ?? []).find((entry) => entry.id === profileId);
      if (!profile) return { ok: false, error: 'Recurring profile not found.' };
      if (!input.profileName.trim()) return { ok: false, error: 'Profile name is required.' };
      if (!input.startDate) return { ok: false, error: 'Start date is required.' };
      if (!input.nextRunDate) return { ok: false, error: 'Next run date is required.' };
      if (!Number.isFinite(input.interval) || input.interval < 1) {
        return { ok: false, error: 'Interval must be at least 1.' };
      }
      if (input.endDate && input.endDate < input.startDate) {
        return { ok: false, error: 'End date cannot be before start date.' };
      }

      const nowIso = new Date().toISOString();
      const nextProfile: RecurringInvoiceProfile = {
        ...profile,
        profileName: input.profileName.trim(),
        frequency: input.frequency,
        interval: Math.floor(input.interval),
        startDate: input.startDate,
        nextRunDate: input.nextRunDate,
        endDate: input.endDate?.trim() || undefined,
        autoSend: input.autoSend,
        updatedAt: nowIso,
      };

      commit((previous) => ({
        ...previous,
        recurringInvoiceProfiles: (previous.recurringInvoiceProfiles ?? []).map((entry) =>
          entry.id === profileId ? nextProfile : entry,
        ),
      }));

      return { ok: true, data: nextProfile };
    },
    setRecurringInvoiceProfileStatus: (profileId, status) => {
      const profile = (state.recurringInvoiceProfiles ?? []).find((entry) => entry.id === profileId);
      if (!profile) return { ok: false, error: 'Recurring profile not found.' };
      const nowIso = new Date().toISOString();
      const nextProfile: RecurringInvoiceProfile = {
        ...profile,
        status,
        updatedAt: nowIso,
      };

      commit((previous) => ({
        ...previous,
        recurringInvoiceProfiles: (previous.recurringInvoiceProfiles ?? []).map((entry) =>
          entry.id === profileId ? nextProfile : entry,
        ),
      }));

      return { ok: true, data: nextProfile };
    },
    deleteRecurringInvoiceProfile: (profileId) => {
      const profile = (state.recurringInvoiceProfiles ?? []).find((entry) => entry.id === profileId);
      if (!profile) return { ok: false, error: 'Recurring profile not found.' };

      commit((previous) => ({
        ...previous,
        recurringInvoiceProfiles: (previous.recurringInvoiceProfiles ?? []).filter((entry) => entry.id !== profileId),
      }));

      notifications.notify({
        level: 'warning',
        source: 'invoices',
        title: 'Recurring Profile Deleted',
        message: `${profile.profileName} has been removed.`,
        persistent: false,
        toast: true,
        route: '/invoices/recurring',
        dedupeKey: `recurring:${profile.id}:deleted`,
      });

      return { ok: true };
    },
    requestInvoiceCreditNote: (invoiceId) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };
      if (invoice.status === 'draft' || invoice.status === 'void') {
        return { ok: false, error: 'Credit notes can only be requested for issued invoices.' };
      }

      const nowIso = new Date().toISOString();
      const nextInvoice = normalizeInvoiceForConsumers({
        ...invoice,
        updatedAt: nowIso,
        activityLog: [
          ...(invoice.activityLog ?? []),
          createInvoiceActivityEvent({
            event: 'credit_note_requested',
            at: nowIso,
            message: 'Credit note request captured from invoice detail.',
          }),
        ],
      });

      commit((previous) => ({
        ...previous,
        invoices: previous.invoices.map((entry) => (entry.id === invoiceId ? nextInvoice : entry)),
      }));

      notifications.notify({
        level: 'warning',
        source: 'invoices',
        title: 'Credit Note Hook Ready',
        message: `Credit note request captured for ${invoice.invoiceNumber}.`,
        persistent: false,
        toast: true,
        route: `/invoices/${invoice.id}`,
        dedupeKey: `invoice:${invoice.id}:credit-note`,
      });

      return { ok: true, data: nextInvoice };
    },
    deleteInvoice: (invoiceId) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };
      const summary = deriveInvoicePaymentSummary(normalizeInvoiceForConsumers(invoice), state.payments);
      if (summary.paidMinor > 0) {
        return { ok: false, error: 'Invoices with payments cannot be deleted.' };
      }

      commit((previous) => ({
        ...previous,
        invoices: previous.invoices.filter((entry) => entry.id !== invoiceId),
      }));

      notifications.notify({
        level: 'warning',
        source: 'invoices',
        title: 'Invoice Deleted',
        message: `${invoice.invoiceNumber} has been deleted.`,
        persistent: true,
        toast: true,
        route: '/invoices',
        dedupeKey: `invoice:${invoiceId}:deleted`,
      });

      return { ok: true };
    },
  };

  return <AccountingContext.Provider value={contextValue}>{children}</AccountingContext.Provider>;
}

export function useAccountingContext(): AccountingContextValue {
  const context = useContext(AccountingContext);
  if (!context) {
    throw new Error('useAccountingContext must be used within AccountingProvider');
  }

  return context;
}
