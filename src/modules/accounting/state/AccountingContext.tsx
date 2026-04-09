import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { createSeedState } from '../data/seed';
import { LocalStorageAccountingRepository } from '../data/localStorageRepository';
import {
  AccountingState,
  Invoice,
  InvoiceFormValues,
  Payment,
  PaymentInput,
  Quote,
  QuoteFormValues,
} from '../domain/types';
import { validateInvoiceForm, validatePaymentInput, validateQuoteForm } from '../domain/validation';
import { mapInvoiceItemsFormToDomain, mapQuoteItemsFormToDomain } from '../domain/mappers';
import { addDaysIsoDate, todayIsoDate } from '../domain/date';
import { createId } from '../domain/id';
import { canConvertQuote, canEditQuote, canTransitionQuote } from '../domain/quote-rules';
import { canEditInvoice, canRecordPayment, canTransitionInvoice } from '../domain/invoice-rules';
import { convertQuoteToInvoice } from '../domain/conversion';
import { toMinor } from '../domain/money';
import { deriveInvoicePaymentSummary } from '../domain/calculations';
import { selectInvoiceById, selectInvoiceSummaries, selectQuoteById, selectQuoteSummaries } from '../domain/selectors';

interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

interface AccountingContextValue {
  state: AccountingState;
  quoteSummaries: ReturnType<typeof selectQuoteSummaries>;
  invoiceSummaries: ReturnType<typeof selectInvoiceSummaries>;
  getQuoteById: (quoteId: string) => Quote | undefined;
  getInvoiceById: (invoiceId: string) => Invoice | undefined;
  getInvoicePayments: (invoiceId: string) => Payment[];
  getInvoicePaymentSummary: (invoiceId: string) => ReturnType<typeof deriveInvoicePaymentSummary> | undefined;
  createQuote: (values: QuoteFormValues) => ActionResult<Quote>;
  updateQuote: (quoteId: string, values: QuoteFormValues) => ActionResult<Quote>;
  duplicateQuote: (quoteId: string) => ActionResult<Quote>;
  transitionQuote: (quoteId: string, target: Quote['status'], note?: string) => ActionResult<Quote>;
  convertQuoteToInvoice: (quoteId: string) => ActionResult<Invoice>;
  createInvoice: (values: InvoiceFormValues) => ActionResult<Invoice>;
  updateInvoice: (invoiceId: string, values: InvoiceFormValues) => ActionResult<Invoice>;
  duplicateInvoice: (invoiceId: string) => ActionResult<Invoice>;
  transitionInvoice: (invoiceId: string, target: Invoice['status'], note?: string) => ActionResult<Invoice>;
  recordPayment: (invoiceId: string, input: PaymentInput) => ActionResult;
}

const repository = new LocalStorageAccountingRepository();
const AccountingContext = createContext<AccountingContextValue | undefined>(undefined);

function isAccountingState(value: unknown): value is AccountingState {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<AccountingState>;
  return (
    Array.isArray(candidate.quotes) &&
    Array.isArray(candidate.invoices) &&
    Array.isArray(candidate.payments) &&
    typeof candidate.quoteSequenceNext === 'number' &&
    typeof candidate.invoiceSequenceNext === 'number'
  );
}

function createInitialState(): AccountingState {
  const loaded = repository.load();
  return isAccountingState(loaded) ? loaded : createSeedState();
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

export function AccountingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountingState>(createInitialState);

  const commit = (updater: (previous: AccountingState) => AccountingState) => {
    setState((previous) => {
      const next = updater(previous);
      repository.save(next);
      return next;
    });
  };

  const quoteSummaries = useMemo(() => selectQuoteSummaries(state), [state]);
  const invoiceSummaries = useMemo(() => selectInvoiceSummaries(state), [state]);

  const contextValue: AccountingContextValue = {
    state,
    quoteSummaries,
    invoiceSummaries,
    getQuoteById: (quoteId) => selectQuoteById(state, quoteId),
    getInvoiceById: (invoiceId) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return undefined;
      const paymentSummary = deriveInvoicePaymentSummary(invoice, state.payments);
      return {
        ...invoice,
        status: paymentSummary.derivedStatus,
      };
    },
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
        const quoteNumber = `QUO-${String(previous.quoteSequenceNext).padStart(5, '0')}`;

        createdQuote = {
          id: quoteId,
          quoteNumber,
          clientId: values.clientId,
          issueDate: values.issueDate,
          expiryDate: values.expiryDate,
          currencyCode: 'ZAR',
          status: 'draft',
          templateId: values.templateId,
          templateVersionId: values.templateVersionId,
          templateName: values.templateName,
          notes: values.notes,
          paymentTerms: values.paymentTerms,
          internalMemo: values.internalMemo,
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
        };

        return {
          ...previous,
          quotes: [createdQuote, ...previous.quotes],
          quoteSequenceNext: previous.quoteSequenceNext + 1,
        };
      });

      return createdQuote
        ? { ok: true, data: createdQuote }
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
      const nextQuote: Quote = {
        ...quote,
        clientId: values.clientId,
        issueDate: values.issueDate,
        expiryDate: values.expiryDate,
        templateId: values.templateId,
        templateVersionId: values.templateVersionId,
        templateName: values.templateName,
        notes: values.notes,
        paymentTerms: values.paymentTerms,
        internalMemo: values.internalMemo,
        documentDiscountPercent: values.documentDiscountPercent,
        items: mapQuoteItemsFormToDomain(values.items),
        updatedAt: nowIso,
      };

      commit((previous) => ({
        ...previous,
        quotes: previous.quotes.map((entry) => (entry.id === quoteId ? nextQuote : entry)),
      }));

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

        duplicateQuote = {
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
        };

        return {
          ...previous,
          quotes: [duplicateQuote, ...previous.quotes],
          quoteSequenceNext: previous.quoteSequenceNext + 1,
        };
      });

      return duplicateQuote
        ? { ok: true, data: duplicateQuote }
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

      commit((previous) => ({
        ...previous,
        quotes: previous.quotes.map((entry) => (entry.id === quoteId ? nextQuote : entry)),
      }));

      return { ok: true, data: nextQuote };
    },
    convertQuoteToInvoice: (quoteId) => {
      const quote = selectQuoteById(state, quoteId);
      if (!quote) return { ok: false, error: 'Quote not found.' };

      const conversion = canConvertQuote(quote.status);
      if (!conversion.allowed) return { ok: false, error: conversion.reason };

      const nowIso = new Date().toISOString();
      let createdInvoice: Invoice | undefined;

      commit((previous) => {
        const invoiceId = createId('invoice');
        const invoiceNumber = `INV-${String(previous.invoiceSequenceNext).padStart(5, '0')}`;

        createdInvoice = convertQuoteToInvoice({
          quote,
          invoiceId,
          invoiceNumber,
          nowIso,
          dueDate: addDaysIsoDate(todayIsoDate(), 14),
        });

        const convertedQuote = appendStatusEvent(
          {
            ...quote,
            status: 'converted',
            convertedInvoiceId: invoiceId,
            updatedAt: nowIso,
          },
          'converted',
          nowIso,
          `Converted to ${invoiceNumber}`,
        );

        return {
          ...previous,
          invoices: [createdInvoice, ...previous.invoices],
          quotes: previous.quotes.map((entry) => (entry.id === quoteId ? convertedQuote : entry)),
          invoiceSequenceNext: previous.invoiceSequenceNext + 1,
        };
      });

      return createdInvoice
        ? { ok: true, data: createdInvoice }
        : { ok: false, error: 'Unable to convert quote.' };
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
        const invoiceNumber = `INV-${String(previous.invoiceSequenceNext).padStart(5, '0')}`;

        createdInvoice = {
          id: invoiceId,
          invoiceNumber,
          clientId: values.clientId,
          issueDate: values.issueDate,
          dueDate: values.dueDate,
          currencyCode: 'ZAR',
          status: 'draft',
          templateId: values.templateId,
          templateVersionId: values.templateVersionId,
          templateName: values.templateName,
          notes: values.notes,
          paymentTerms: values.paymentTerms,
          internalMemo: values.internalMemo,
          items: mapInvoiceItemsFormToDomain(values.items),
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
        };

        return {
          ...previous,
          invoices: [createdInvoice, ...previous.invoices],
          invoiceSequenceNext: previous.invoiceSequenceNext + 1,
        };
      });

      return createdInvoice
        ? { ok: true, data: createdInvoice }
        : { ok: false, error: 'Unable to create invoice.' };
    },
    updateInvoice: (invoiceId, values) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };

      const summary = deriveInvoicePaymentSummary(invoice, state.payments);
      const editable = canEditInvoice(summary.derivedStatus);
      if (!editable.allowed) return { ok: false, error: editable.reason };

      const validation = validateInvoiceForm(values);
      if (!validation.isValid) {
        return { ok: false, error: summarizeValidationErrors(validation.issues) };
      }

      const nowIso = new Date().toISOString();
      const nextInvoice: Invoice = {
        ...invoice,
        clientId: values.clientId,
        issueDate: values.issueDate,
        dueDate: values.dueDate,
        templateId: values.templateId,
        templateVersionId: values.templateVersionId,
        templateName: values.templateName,
        notes: values.notes,
        paymentTerms: values.paymentTerms,
        internalMemo: values.internalMemo,
        documentDiscountPercent: values.documentDiscountPercent,
        items: mapInvoiceItemsFormToDomain(values.items),
        updatedAt: nowIso,
      };

      commit((previous) => ({
        ...previous,
        invoices: previous.invoices.map((entry) => (entry.id === invoiceId ? nextInvoice : entry)),
      }));

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

        duplicateInvoice = {
          ...source,
          id: nextId,
          invoiceNumber: nextNumber,
          status: 'draft',
          issueDate,
          dueDate: addDaysIsoDate(issueDate, 14),
          sourceQuoteId: undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
          sentAt: undefined,
          voidedAt: undefined,
          approvedAt: undefined,
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
        };

        return {
          ...previous,
          invoices: [duplicateInvoice, ...previous.invoices],
          invoiceSequenceNext: previous.invoiceSequenceNext + 1,
        };
      });

      return duplicateInvoice
        ? { ok: true, data: duplicateInvoice }
        : { ok: false, error: 'Unable to duplicate invoice.' };
    },
    transitionInvoice: (invoiceId, target, note) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };

      const currentStatus = deriveInvoicePaymentSummary(invoice, state.payments).derivedStatus;
      const transition = canTransitionInvoice(currentStatus, target);
      if (!transition.allowed) return { ok: false, error: transition.reason };

      const nowIso = new Date().toISOString();
      let nextInvoice: Invoice = {
        ...invoice,
        status: target,
        updatedAt: nowIso,
      };

      if (target === 'sent') nextInvoice.sentAt = nowIso;
      if (target === 'approved') nextInvoice.approvedAt = nowIso;
      if (target === 'void') nextInvoice.voidedAt = nowIso;

      nextInvoice = appendStatusEvent(nextInvoice, target, nowIso, note);

      commit((previous) => ({
        ...previous,
        invoices: previous.invoices.map((entry) => (entry.id === invoiceId ? nextInvoice : entry)),
      }));

      return { ok: true, data: nextInvoice };
    },
    recordPayment: (invoiceId, input) => {
      const invoice = selectInvoiceById(state, invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };

      const currentSummary = deriveInvoicePaymentSummary(invoice, state.payments);
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
      const nextSummary = deriveInvoicePaymentSummary(invoice, nextPayments);

      let nextInvoice: Invoice = {
        ...invoice,
        status: nextSummary.derivedStatus,
        updatedAt: nowIso,
      };

      if (nextSummary.derivedStatus !== invoice.status) {
        nextInvoice = appendStatusEvent(
          nextInvoice,
          nextSummary.derivedStatus,
          nowIso,
          `Payment recorded: ${input.amount.toFixed(2)}`,
        );
      }

      commit((previous) => ({
        ...previous,
        payments: [payment, ...previous.payments],
        invoices: previous.invoices.map((entry) => (entry.id === invoiceId ? nextInvoice : entry)),
      }));

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
