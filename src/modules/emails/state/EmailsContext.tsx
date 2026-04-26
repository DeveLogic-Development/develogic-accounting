import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { appConfig } from '@/config/appConfig';
import { Invoice, Quote } from '@/modules/accounting/domain/types';
import {
  buildEftInstructionLines,
  buildInvoicePaymentReference,
  buildInvoicePaymentSubmissionUrl,
} from '@/modules/accounting/domain/eft';
import { calculateDocumentTotals } from '@/modules/accounting/domain/calculations';
import { useAccountingContext } from '@/modules/accounting/state/AccountingContext';
import { usePdfArchiveContext } from '@/modules/pdf/state/PdfArchiveContext';
import { useNotificationsContext } from '@/modules/notifications/state/NotificationsContext';
import { useBusinessSettings } from '@/modules/settings/hooks/useBusinessSettings';
import { canUseSupabaseRuntimeState, loadRuntimeState, saveRuntimeState } from '@/lib/supabase/runtime-state';
import { formatMinorCurrency } from '@/utils/format';
import { useMasterDataContext } from '@/modules/master-data/state/MasterDataContext';
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
  EmailCapability,
  EmailComposeDraft,
  EmailLogListRow,
  EmailLogRecord,
  EmailsState,
  EmailTemplateKind,
} from '../domain/types';
import { summarizeEmailValidationIssues, validateComposeDraft } from '../domain/validation';
import { derivePostSendInvoiceStatuses, derivePostSendQuoteStatus } from '../domain/workflow';
import { fetchEmailCapability, sendEmailTransport } from '../services/client';

interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  warning?: string;
  data?: T;
}

interface EmailsContextValue {
  state: EmailsState;
  rows: EmailLogListRow[];
  emailCapability: EmailCapability;
  emailCapabilityLoading: boolean;
  canSendEmails: boolean;
  emailAvailabilityMessage?: string;
  refreshEmailCapability: () => Promise<void>;
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
const REMOTE_STATE_KEY = 'emails';

function isEmailsState(value: unknown): value is EmailsState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EmailsState>;
  return Array.isArray(candidate.logs);
}

function createInitialState(): EmailsState {
  const loaded = repository.load();
  return isEmailsState(loaded) ? loaded : createEmailSeedState();
}

function buildDefaultDraftFromQuote(input: {
  quote: Quote;
  client?: { name: string; email?: string };
  latestImmutablePdfId?: string;
  businessName: string;
}): EmailComposeDraft {
  const quote = input.quote;
  const totals = calculateDocumentTotals(quote.items, quote.documentDiscountPercent);
  const preferredRecipient =
    quote.recipientEmails && quote.recipientEmails.length > 0
      ? quote.recipientEmails[0]
      : input.client?.email ?? '';

  const payload = {
    businessName: input.businessName,
    clientName: input.client?.name ?? quote.clientId,
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
      clientName: input.client?.name ?? quote.clientId,
    },
    templateKind,
    recipient: {
      to: preferredRecipient,
    },
    subject: buildDefaultEmailSubject(templateKind, payload),
    body: buildDefaultEmailBody(templateKind, payload),
    attachmentRecordId: input.latestImmutablePdfId,
  };
}

function buildDefaultDraftFromInvoice(input: {
  invoice: Invoice;
  client?: { name: string; email?: string };
  latestImmutablePdfId?: string;
  businessName: string;
  paymentReferenceInstruction: string;
  eftInstructionNotes: string;
  proofSubmissionUrl?: string;
}): EmailComposeDraft {
  const invoice = input.invoice;
  const totals = calculateDocumentTotals(invoice.items, invoice.documentDiscountPercent);

  const payload = {
    businessName: input.businessName,
    clientName: input.client?.name ?? invoice.clientId,
    documentNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalFormatted: formatMinorCurrency(totals.totalMinor, invoice.currencyCode),
    paymentReferenceInstruction: input.paymentReferenceInstruction,
    eftInstructionNotes: input.eftInstructionNotes,
    proofSubmissionUrl: input.proofSubmissionUrl,
  };

  const templateKind: EmailTemplateKind = 'invoice_send';

  return {
    document: {
      documentType: 'invoice',
      documentId: invoice.id,
      documentNumber: invoice.invoiceNumber,
      documentStatus: invoice.status,
      clientId: invoice.clientId,
      clientName: input.client?.name ?? invoice.clientId,
    },
    templateKind,
    recipient: {
      to: input.client?.email ?? '',
    },
    subject: buildDefaultEmailSubject(templateKind, payload),
    body: buildDefaultEmailBody(templateKind, payload),
    attachmentRecordId: input.latestImmutablePdfId,
  };
}

export function EmailsProvider({ children }: { children: ReactNode }) {
  const accounting = useAccountingContext();
  const pdfArchive = usePdfArchiveContext();
  const notifications = useNotificationsContext();
  const businessSettings = useBusinessSettings();
  const masterData = useMasterDataContext();
  const [state, setState] = useState<EmailsState>(createInitialState);
  const [remoteHydrationComplete, setRemoteHydrationComplete] = useState(!canUseSupabaseRuntimeState());
  const [emailCapability, setEmailCapability] = useState<EmailCapability>({
    canSend: false,
    mode: 'unknown',
    reason: appConfig.features.emailEnabled
      ? 'Checking email capability...'
      : 'Email feature is disabled by configuration.',
    checkedAt: new Date().toISOString(),
    source: 'fallback',
  });
  const [emailCapabilityLoading, setEmailCapabilityLoading] = useState(true);

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
          attemptedAt: log.attemptedAt ?? '',
          sentAt: log.sentAt,
          hasAttachment: Boolean(log.attachment),
          attachmentFileName: log.attachment?.fileName,
          resendOfLogId: log.resendOfLogId,
          errorMessage: log.errorMessage,
        }))
        .sort((a, b) => (b.attemptedAt ?? '').localeCompare(a.attemptedAt ?? '')),
    [state.logs],
  );

  useEffect(() => {
    if (!canUseSupabaseRuntimeState()) return;

    let active = true;
    loadRuntimeState<EmailsState>(REMOTE_STATE_KEY).then((result) => {
      if (!active) return;
      if (result.ok && result.data && isEmailsState(result.data)) {
        setState(result.data);
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

  const refreshEmailCapability = async () => {
    if (!appConfig.features.emailEnabled) {
      setEmailCapability({
        canSend: false,
        mode: 'disabled',
        reason: 'Email feature is disabled by client configuration.',
        checkedAt: new Date().toISOString(),
        source: 'fallback',
      });
      setEmailCapabilityLoading(false);
      return;
    }

    setEmailCapabilityLoading(true);
    const capability = await fetchEmailCapability();
    setEmailCapability(capability);
    setEmailCapabilityLoading(false);
  };

  useEffect(() => {
    refreshEmailCapability();
  }, []);

  const canSendEmails =
    appConfig.features.emailEnabled &&
    !emailCapabilityLoading &&
    emailCapability.canSend;
  const emailAvailabilityMessage = !appConfig.features.emailEnabled
    ? 'Email feature is disabled in client configuration.'
    : emailCapability.reason;

  useEffect(() => {
    if (emailCapabilityLoading || canSendEmails) return;
    notifications.createNotification(
      {
        level: 'warning',
        source: 'system',
        title: 'Email Delivery Unavailable',
        message: emailAvailabilityMessage ?? 'Email sending is currently unavailable.',
        route: '/emails/history',
        dedupeKey: `email-capability:${emailCapability.mode}:${emailAvailabilityMessage ?? 'unknown'}`,
      },
      { dedupeWindowMs: 1000 * 60 * 60 * 24 * 30 },
    );
  }, [
    canSendEmails,
    emailAvailabilityMessage,
    emailCapability.mode,
    emailCapabilityLoading,
    notifications,
  ]);

  const contextValue: EmailsContextValue = {
    state,
    rows,
    emailCapability,
    emailCapabilityLoading,
    canSendEmails,
    emailAvailabilityMessage,
    refreshEmailCapability,
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
            client: masterData.getClientById(quote.clientId),
            latestImmutablePdfId: latestImmutable?.id,
            businessName: businessSettings.businessName,
          }),
        };
      }

      const invoice = accounting.getInvoiceById(documentId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };
      const client = masterData.getClientById(invoice.clientId);
      const clientName = client?.name ?? invoice.clientId;

      const ensuredPaymentLink = businessSettings.eftPublicSubmissionEnabled
        ? accounting.ensureInvoicePublicPaymentLink(invoice.id, {
            clientName,
          })
        : undefined;
      const invoiceForEmail = ensuredPaymentLink?.ok
        ? accounting.getInvoiceById(invoice.id) ?? invoice
        : invoice;

      const paymentReference = invoiceForEmail.eftPaymentReference ?? buildInvoicePaymentReference({
        invoiceNumber: invoiceForEmail.invoiceNumber,
        clientName,
        instructionTemplate: businessSettings.eftReferenceInstruction,
      });
      const eftInstructionLines = buildEftInstructionLines({
        invoiceNumber: invoiceForEmail.invoiceNumber,
        clientName,
        settings: businessSettings,
      });
      const baseUrl =
        appConfig.app.baseUrl ||
        (typeof window !== 'undefined' ? window.location.origin : undefined);
      const proofSubmissionUrl = businessSettings.eftIncludePublicSubmissionLinkInEmail
        ? buildInvoicePaymentSubmissionUrl(baseUrl, invoiceForEmail.publicPaymentToken)
        : '';

      return {
        ok: true,
        data: buildDefaultDraftFromInvoice({
          invoice: invoiceForEmail,
          client,
          latestImmutablePdfId: latestImmutable?.id,
          businessName: businessSettings.businessName,
          paymentReferenceInstruction: paymentReference,
          eftInstructionNotes: eftInstructionLines.join('\n'),
          proofSubmissionUrl,
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
      if (!canSendEmails) {
        notifications.pushToast({
          level: 'warning',
          title: 'Email Unavailable',
          message: emailAvailabilityMessage ?? 'Email sending is currently unavailable.',
        });
        return {
          ok: false,
          error: emailAvailabilityMessage ?? 'Email sending is currently unavailable.',
        };
      }

      const validation = validateComposeDraft(draft);
      if (!validation.isValid) {
        notifications.pushToast({
          level: 'error',
          title: 'Email Validation Failed',
          message: summarizeEmailValidationIssues(validation.issues),
        });
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
        notifications.notify({
          level: 'error',
          source: 'email',
          title: 'Email Send Failed',
          message: failed.errorMessage ?? 'Attachment resolution failed.',
          persistent: true,
          toast: true,
          route: '/emails/history',
          relatedEntityType: 'email_log',
          relatedEntityId: failed.id,
          dedupeKey: `email-failed:${failed.id}`,
        });
        return { ok: false, error: failed.errorMessage };
      }

      const attachmentRecord = resolveResult.record;
      const attachment = mapPdfRecordToAttachmentReference(attachmentRecord);
      if (
        emailCapability.maxAttachmentBytes &&
        attachmentRecord.file.sizeBytes > emailCapability.maxAttachmentBytes
      ) {
        const failed = markEmailLogFailed({
          log: markEmailLogSending(queuedLog),
          attachment,
          attemptedAt: new Date().toISOString(),
          code: 'ATTACHMENT_TOO_LARGE',
          message: 'Attachment exceeds configured email size limit.',
        });
        replaceLog(queuedLog.id, () => failed);
        notifications.notify({
          level: 'error',
          source: 'email',
          title: 'Email Send Failed',
          message: failed.errorMessage ?? 'Attachment exceeds configured email size limit.',
          persistent: true,
          toast: true,
          route: '/emails/history',
          relatedEntityType: 'email_log',
          relatedEntityId: failed.id,
          dedupeKey: `email-failed:${failed.id}`,
        });
        return { ok: false, error: failed.errorMessage };
      }

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
        notifications.notify({
          level: 'error',
          source: 'email',
          title: 'Email Send Failed',
          message: failed.errorMessage ?? 'Attachment data could not be encoded for transport.',
          persistent: true,
          toast: true,
          route: '/emails/history',
          relatedEntityType: 'email_log',
          relatedEntityId: failed.id,
          dedupeKey: `email-failed:${failed.id}`,
        });
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
        notifications.notify({
          level: 'error',
          source: 'email',
          title: 'Email Delivery Failed',
          message: failed.errorMessage ?? 'Email send failed.',
          persistent: true,
          toast: true,
          route: '/emails/history',
          relatedEntityType: 'email_log',
          relatedEntityId: failed.id,
          dedupeKey: `email-failed:${failed.id}`,
        });
        return { ok: false, error: failed.errorMessage };
      }

      const sentLog = markEmailLogSent({
        log: markEmailLogSending(queuedLog),
        attachment,
        result: sendResult,
      });
      replaceLog(queuedLog.id, () => sentLog);

      notifications.notify({
        level: 'success',
        source: 'email',
        title: draft.resendOfLogId ? 'Email Resent' : 'Email Sent',
        message: `${sentLog.document.documentNumber} was sent to ${sentLog.recipient.to}.`,
        persistent: true,
        toast: true,
        route: '/emails/history',
        relatedEntityType: 'email_log',
        relatedEntityId: sentLog.id,
        dedupeKey: `email-sent:${sentLog.id}`,
      });

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
