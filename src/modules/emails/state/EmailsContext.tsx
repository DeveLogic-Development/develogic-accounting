import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { clients } from '@/mocks/data';
import { Invoice, Quote } from '@/modules/accounting/domain/types';
import { calculateDocumentTotals } from '@/modules/accounting/domain/calculations';
import { useAccountingContext } from '@/modules/accounting/state/AccountingContext';
import { usePdfArchiveContext } from '@/modules/pdf/state/PdfArchiveContext';
import { formatMinorCurrency } from '@/utils/format';
import { createEmailSeedState } from '../data/seed';
import { LocalStorageEmailsRepository } from '../data/localStorageRepository';
import { mapPdfRecordToAttachmentReference, resolveAttachmentRecordForSend } from '../domain/attachments';
import {
  createQueuedEmailLog,
  markEmailLogFailed,
  markEmailLogSending,
  markEmailLogSent,
} from '../domain/logs';
import {
  buildDefaultEmailBody,
  buildDefaultEmailSubject,
} from '../domain/templates';
import { buildEmailTransportPayload } from '../domain/transport';
import {
  EmailComposeDraft,
  EmailLogListRow,
  EmailLogRecord,
  EmailsState,
  EmailTemplateKind,
} from '../domain/types';
import { summarizeEmailValidationIssues, validateComposeDraft } from '../domain/validation';
import { derivePostSendInvoiceStatuses, derivePostSendQuoteStatus } from '../domain/workflow';
import { sendEmailTransport } from '../services/client';

interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  warning?: string;
  data?: T;
}

interface EmailsContextValue {
  state: EmailsState;
  rows: EmailLogListRow[];
  getLogById: (logId: string) => EmailLogRecord | undefined;
  getLogsForDocument: (input: { documentType: 'quote' | 'invoice'; documentId: string }) => EmailLogRecord[];
  createComposeDraftForDocument: (
    input: { documentType: 'quote' | 'invoice'; documentId: string },
  ) => ActionResult<EmailComposeDraft>;
  createComposeDraftForResend: (logId: string) => ActionResult<EmailComposeDraft>;
  sendEmailDraft: (draft: EmailComposeDraft) => Promise<ActionResult<EmailLogRecord>>;
}

const repository = new LocalStorageEmailsRepository();
const EmailsContext = createContext<EmailsContextValue | undefined>(undefined);

function isEmailsState(value: unknown): value is EmailsState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EmailsState>;
  return Array.isArray(candidate.logs);
}

function createInitialState(): EmailsState {
  const loaded = repository.load();
  return isEmailsState(loaded) ? loaded : createEmailSeedState();
}

function findClient(clientId: string) {
  return clients.find((entry) => entry.id === clientId);
}

function buildDefaultDraftFromQuote(input: {
  quote: Quote;
  latestImmutablePdfId?: string;
}): EmailComposeDraft {
  const quote = input.quote;
  const client = findClient(quote.clientId);
  const totals = calculateDocumentTotals(quote.items, quote.documentDiscountPercent);

  const payload = {
    businessName: 'DeveLogic Digital',
    clientName: client?.name ?? quote.clientId,
    documentNumber: quote.quoteNumber,
    issueDate: quote.issueDate,
    expiryDate: quote.expiryDate,
    totalFormatted: formatMinorCurrency(totals.totalMinor, quote.currencyCode),
  };

  const templateKind: EmailTemplateKind = 'quote_send';

  return {
    document: {
      documentType: 'quote',
      documentId: quote.id,
      documentNumber: quote.quoteNumber,
      documentStatus: quote.status,
      clientId: quote.clientId,
      clientName: client?.name ?? quote.clientId,
    },
    templateKind,
    recipient: {
      to: client?.email ?? '',
    },
    subject: buildDefaultEmailSubject(templateKind, payload),
    body: buildDefaultEmailBody(templateKind, payload),
    attachmentRecordId: input.latestImmutablePdfId,
  };
}

function buildDefaultDraftFromInvoice(input: {
  invoice: Invoice;
  latestImmutablePdfId?: string;
}): EmailComposeDraft {
  const invoice = input.invoice;
  const client = findClient(invoice.clientId);
  const totals = calculateDocumentTotals(invoice.items, invoice.documentDiscountPercent);

  const payload = {
    businessName: 'DeveLogic Digital',
    clientName: client?.name ?? invoice.clientId,
    documentNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalFormatted: formatMinorCurrency(totals.totalMinor, invoice.currencyCode),
  };

  const templateKind: EmailTemplateKind = 'invoice_send';

  return {
    document: {
      documentType: 'invoice',
      documentId: invoice.id,
      documentNumber: invoice.invoiceNumber,
      documentStatus: invoice.status,
      clientId: invoice.clientId,
      clientName: client?.name ?? invoice.clientId,
    },
    templateKind,
    recipient: {
      to: client?.email ?? '',
    },
    subject: buildDefaultEmailSubject(templateKind, payload),
    body: buildDefaultEmailBody(templateKind, payload),
    attachmentRecordId: input.latestImmutablePdfId,
  };
}

export function EmailsProvider({ children }: { children: ReactNode }) {
  const accounting = useAccountingContext();
  const pdfArchive = usePdfArchiveContext();
  const [state, setState] = useState<EmailsState>(createInitialState);

  const commit = (updater: (previous: EmailsState) => EmailsState) => {
    setState((previous) => {
      const next = updater(previous);
      repository.save(next);
      return next;
    });
  };

  const replaceLog = (logId: string, updater: (log: EmailLogRecord) => EmailLogRecord) => {
    commit((previous) => ({
      ...previous,
      logs: previous.logs.map((entry) => (entry.id === logId ? updater(entry) : entry)),
    }));
  };

  const rows = useMemo<EmailLogListRow[]>(
    () =>
      state.logs
        .map((log) => ({
          id: log.id,
          status: log.status,
          documentType: log.document.documentType,
          documentId: log.document.documentId,
          documentNumber: log.document.documentNumber,
          recipientEmail: log.recipient.to,
          subject: log.subject,
          bodySnippet: log.bodySnippet,
          attemptedAt: log.attemptedAt,
          sentAt: log.sentAt,
          hasAttachment: Boolean(log.attachment),
          attachmentFileName: log.attachment?.fileName,
          resendOfLogId: log.resendOfLogId,
          errorMessage: log.errorMessage,
        }))
        .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt)),
    [state.logs],
  );

  const contextValue: EmailsContextValue = {
    state,
    rows,
    getLogById: (logId) => state.logs.find((entry) => entry.id === logId),
    getLogsForDocument: ({ documentType, documentId }) =>
      state.logs
        .filter(
          (entry) =>
            entry.document.documentType === documentType &&
            entry.document.documentId === documentId,
        )
        .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt)),
    createComposeDraftForDocument: ({ documentType, documentId }) => {
      const latestImmutable = pdfArchive.getLatestPdfForDocument({
        documentType,
        documentId,
        immutableOnly: true,
      });

      if (documentType === 'quote') {
        const quote = accounting.getQuoteById(documentId);
        if (!quote) return { ok: false, error: 'Quote not found.' };

        return {
          ok: true,
          data: buildDefaultDraftFromQuote({
            quote,
            latestImmutablePdfId: latestImmutable?.id,
          }),
        };
      }

      const invoice = accounting.getInvoiceById(documentId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };

      return {
        ok: true,
        data: buildDefaultDraftFromInvoice({
          invoice,
          latestImmutablePdfId: latestImmutable?.id,
        }),
      };
    },
    createComposeDraftForResend: (logId) => {
      const log = state.logs.find((entry) => entry.id === logId);
      if (!log) return { ok: false, error: 'Email log record not found.' };

      return {
        ok: true,
        data: {
          document: log.document,
          templateKind: log.templateKind,
          recipient: log.recipient,
          subject: log.subject,
          body: log.body,
          attachmentRecordId: log.attachment?.pdfArchiveRecordId,
          resendOfLogId: log.id,
        },
      };
    },
    sendEmailDraft: async (draft) => {
      const validation = validateComposeDraft(draft);
      if (!validation.isValid) {
        return {
          ok: false,
          error: summarizeEmailValidationIssues(validation.issues),
        };
      }

      const attemptedAt = new Date().toISOString();
      const queuedLog = createQueuedEmailLog(draft, attemptedAt);

      commit((previous) => ({
        ...previous,
        logs: [queuedLog, ...previous.logs],
      }));

      replaceLog(queuedLog.id, (current) => markEmailLogSending(current));

      const resolveResult = await resolveAttachmentRecordForSend({
        documentType: draft.document.documentType,
        documentId: draft.document.documentId,
        preferredRecordId: draft.attachmentRecordId,
        resendAttachmentRecordId: draft.resendOfLogId
          ? state.logs.find((entry) => entry.id === draft.resendOfLogId)?.attachment?.pdfArchiveRecordId
          : undefined,
        getRecordById: (recordId) => pdfArchive.getRecordById(recordId),
        getLatestImmutableRecord: ({ documentType, documentId }) =>
          pdfArchive.getLatestPdfForDocument({
            documentType,
            documentId,
            immutableOnly: true,
          }),
        generateHistoricalArchive: () =>
          draft.document.documentType === 'quote'
            ? pdfArchive.generateQuotePdf(draft.document.documentId, {
                generationMode: 'historical_archive',
                source: 'system',
              })
            : pdfArchive.generateInvoicePdf(draft.document.documentId, {
                generationMode: 'historical_archive',
                source: 'system',
              }),
      });

      if (!resolveResult.ok || !resolveResult.record) {
        const failed = markEmailLogFailed({
          log: markEmailLogSending(queuedLog),
          attemptedAt: new Date().toISOString(),
          code: 'ATTACHMENT_RESOLUTION_FAILED',
          message: resolveResult.error ?? 'Attachment resolution failed.',
        });
        replaceLog(queuedLog.id, () => failed);
        return { ok: false, error: failed.errorMessage };
      }

      const attachmentRecord = resolveResult.record;
      const attachment = mapPdfRecordToAttachmentReference(attachmentRecord);
      const transportPayload = buildEmailTransportPayload({
        draft,
        attachmentRecord,
      });

      if (!transportPayload) {
        const failed = markEmailLogFailed({
          log: markEmailLogSending(queuedLog),
          attachment,
          attemptedAt: new Date().toISOString(),
          code: 'ATTACHMENT_CONTENT_INVALID',
          message: 'Attachment data could not be encoded for transport.',
        });
        replaceLog(queuedLog.id, () => failed);
        return { ok: false, error: failed.errorMessage };
      }

      const sendResult = await sendEmailTransport(transportPayload);

      if (!sendResult.ok) {
        const failed = markEmailLogFailed({
          log: markEmailLogSending(queuedLog),
          attachment,
          attemptedAt: sendResult.attemptedAt,
          code: sendResult.error?.code ?? 'EMAIL_SEND_FAILED',
          message: sendResult.error?.message ?? 'Email send failed.',
        });
        replaceLog(queuedLog.id, () => failed);
        return { ok: false, error: failed.errorMessage };
      }

      const sentLog = markEmailLogSent({
        log: markEmailLogSending(queuedLog),
        attachment,
        result: sendResult,
      });
      replaceLog(queuedLog.id, () => sentLog);

      let warning: string | undefined;
      if (draft.document.documentType === 'quote') {
        const currentQuote = accounting.getQuoteById(draft.document.documentId);
        if (currentQuote) {
          const nextStatus = derivePostSendQuoteStatus(currentQuote.status);
          if (nextStatus) {
            const transition = accounting.transitionQuote(
              currentQuote.id,
              nextStatus,
              'Marked sent after successful email delivery.',
            );
            if (!transition.ok) {
              warning = transition.error ?? 'Quote status could not be updated after send.';
            }
          }
        }
      } else {
        const currentInvoice = accounting.getInvoiceById(draft.document.documentId);
        if (currentInvoice) {
          const statuses = derivePostSendInvoiceStatuses(currentInvoice.status);
          for (const status of statuses) {
            const transition = accounting.transitionInvoice(
              currentInvoice.id,
              status,
              'Updated after successful invoice email delivery.',
            );
            if (!transition.ok) {
              warning = transition.error ?? 'Invoice status could not be updated after send.';
              break;
            }
          }
        }
      }

      return {
        ok: true,
        warning,
        data: sentLog,
      };
    },
  };

  return <EmailsContext.Provider value={contextValue}>{children}</EmailsContext.Provider>;
}

export function useEmailsContext(): EmailsContextValue {
  const context = useContext(EmailsContext);
  if (!context) {
    throw new Error('useEmailsContext must be used within EmailsProvider');
  }
  return context;
}
