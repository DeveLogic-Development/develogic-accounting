import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { EmailStatusBadge, InvoiceStatusBadge } from '@/design-system/patterns/StatusBadge';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { Tabs } from '@/design-system/primitives/Tabs';
import { Textarea } from '@/design-system/primitives/Textarea';
import { IconButton } from '@/design-system/primitives/IconButton';
import { formatBytes, formatDate, formatMinorCurrency } from '@/utils/format';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { useTemplates } from '@/modules/templates/hooks/useTemplates';
import { calculateDocumentTotals } from '@/modules/accounting/domain/calculations';
import {
  canCreateCreditNote,
  canMakeInvoiceRecurring,
  getInvoiceActionAvailability,
} from '@/modules/accounting/domain/invoice-rules';
import { DocumentLineItemsTable } from '@/modules/accounting/components/DocumentLineItemsTable';
import { RecordPaymentForm } from '@/modules/accounting/components/RecordPaymentForm';
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';
import { useEmails } from '@/modules/emails/hooks/useEmails';
import { EmailComposeModal } from '@/modules/emails/components/EmailComposeModal';
import { EmailComposeDraft } from '@/modules/emails/domain/types';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { createDefaultTemplateConfigForType } from '@/modules/templates/domain/defaults';
import { buildPreviewPayloadFromInvoice, buildPreviewRowsFromDomainItems } from '@/modules/templates/domain/preview-builders';
import { TemplatePreviewRenderer } from '@/modules/templates/components/TemplatePreviewRenderer';
import { InvoiceActivityEvent, InvoiceAttachment, StatusEvent } from '@/modules/accounting/domain/types';

type DetailTab = 'invoice_details' | 'activity_logs';
type DocumentViewMode = 'details' | 'pdf';

const DETAIL_TABS: Array<{ key: DetailTab; label: string }> = [
  { key: 'invoice_details', label: 'Invoice Details' },
  { key: 'activity_logs', label: 'Activity Logs' },
];

interface InvoicePreferencesDraft {
  discountMode: 'line' | 'transaction';
  roundingMode: 'none' | 'nearest_whole' | 'nearest_increment';
  showSalesperson: boolean;
}

function mapStatusHistoryToActivity(entries: StatusEvent<string>[]): InvoiceActivityEvent[] {
  return entries.map((entry) => ({
    id: `status_${entry.id}`,
    event: 'status_changed',
    at: entry.at,
    message: `Status changed to ${entry.status.replace('_', ' ')}${entry.note ? ` · ${entry.note}` : ''}`,
  }));
}

function mapAddressLines(snapshot?: {
  attention?: string;
  line1?: string;
  line2?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  countryRegion?: string;
}): string[] {
  if (!snapshot) return [];
  return [
    snapshot.attention,
    snapshot.line1,
    snapshot.line2,
    [snapshot.city, snapshot.stateRegion, snapshot.postalCode].filter(Boolean).join(' '),
    snapshot.countryRegion,
  ].filter(Boolean) as string[];
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function InvoiceDetailPage() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const {
    getInvoiceById,
    getInvoicePaymentSummary,
    getInvoicePayments,
    transitionInvoice,
    recordPayment,
    duplicateInvoice,
    deleteInvoice,
    addInvoiceAttachment,
    removeInvoiceAttachment,
    requestInvoiceRecurring,
    requestInvoiceCreditNote,
  } = useAccounting();
  const { getTemplateById, getTemplateVersionById } = useTemplates();
  const {
    generateInvoicePdf,
    getPdfRecordsForDocument,
    openPdfRecord,
    downloadPdfRecord,
  } = usePdfArchive();
  const {
    getLogsForDocument,
    createComposeDraftForDocument,
    sendEmailDraft,
    canSendEmails,
    emailCapabilityLoading,
    emailAvailabilityMessage,
  } = useEmails();
  const { getClientById } = useMasterData();

  const [activeTab, setActiveTab] = useState<DetailTab>('invoice_details');
  const [viewMode, setViewMode] = useState<DocumentViewMode>('pdf');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<EmailComposeDraft | null>(null);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [moreMenuStyle, setMoreMenuStyle] = useState<CSSProperties | null>(null);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [preferencesDraft, setPreferencesDraft] = useState<InvoicePreferencesDraft>({
    discountMode: 'line',
    roundingMode: 'none',
    showSalesperson: true,
  });

  const moreMenuRootRef = useRef<HTMLDivElement | null>(null);
  const moreMenuPopoverRef = useRef<HTMLDivElement | null>(null);

  const invoice = invoiceId ? getInvoiceById(invoiceId) : undefined;

  useEffect(() => {
    if (!showMoreMenu) return;
    const updatePopoverPosition = () => {
      if (!moreMenuRootRef.current) return;
      const triggerRect = moreMenuRootRef.current.getBoundingClientRect();
      const menuWidth = 220;
      const estimatedMenuHeight = 260;
      const viewportPadding = 8;
      const top = Math.min(window.innerHeight - estimatedMenuHeight - viewportPadding, triggerRect.bottom + 6);
      const left = Math.max(
        viewportPadding,
        Math.min(window.innerWidth - menuWidth - viewportPadding, triggerRect.right - menuWidth),
      );
      setMoreMenuStyle({
        position: 'fixed',
        top,
        left,
        width: menuWidth,
        zIndex: 130,
      });
    };

    updatePopoverPosition();
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (moreMenuRootRef.current?.contains(target) || moreMenuPopoverRef.current?.contains(target)) return;
      setShowMoreMenu(false);
    };
    const handleViewportChange = () => updatePopoverPosition();
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [showMoreMenu]);

  if (!invoice) {
    return (
      <EmptyState
        title="Invoice not found"
        description="The invoice may have been deleted or is unavailable."
        action={
          <Link to="/invoices">
            <Button variant="primary">Back to Invoices</Button>
          </Link>
        }
      />
    );
  }

  const totals = calculateDocumentTotals(invoice.items, invoice.documentDiscountPercent, invoice.adjustmentMinor ?? 0);
  const paymentSummary = getInvoicePaymentSummary(invoice.id);
  const paidMinor = paymentSummary?.paidMinor ?? 0;
  const outstandingMinor = paymentSummary?.outstandingMinor ?? totals.totalMinor;
  const payments = getInvoicePayments(invoice.id);

  const client = getClientById(invoice.clientId);
  const template = getTemplateById(invoice.templateId ?? '');
  const templateVersion = getTemplateVersionById(invoice.templateVersionId);
  const actionAvailability = getInvoiceActionAvailability(invoice.status, outstandingMinor);
  const pdfRecords = getPdfRecordsForDocument({ documentType: 'invoice', documentId: invoice.id });
  const latestPdf = pdfRecords[0];
  const latestImmutablePdf = pdfRecords.find((record) => record.immutable);
  const latestDraftPdf = pdfRecords.find((record) => !record.immutable);
  const emailLogs = getLogsForDocument({ documentType: 'invoice', documentId: invoice.id });
  const recentEmailLogs = emailLogs.slice(0, 3);
  const sendDisabledReason = emailCapabilityLoading
    ? 'Checking email capability...'
    : !canSendEmails
      ? (emailAvailabilityMessage ?? 'Email sending is currently unavailable.')
      : !actionAvailability.canSend.allowed
        ? actionAvailability.canSend.reason
        : undefined;

  const attachmentOptions = useMemo(
    () =>
      pdfRecords.map((record) => ({
        value: record.id,
        label: `v${record.revision} · ${record.file.fileName} ${record.immutable ? '(Immutable)' : '(Draft)'}`,
      })),
    [pdfRecords],
  );

  const orderedActivityEvents = useMemo(() => {
    const emailEvents: InvoiceActivityEvent[] = emailLogs.map((entry) => ({
      id: `email_${entry.id}`,
      event: 'emailed',
      at: entry.sentAt ?? entry.attemptedAt,
      message:
        entry.status === 'sent'
          ? `Invoice emailed to ${entry.recipient.to}.`
          : `Invoice email ${entry.status}${entry.errorMessage ? ` · ${entry.errorMessage}` : ''}.`,
    }));
    const pdfEvents: InvoiceActivityEvent[] = pdfRecords.map((record) => ({
      id: `pdf_${record.id}`,
      event: 'updated',
      at: record.generatedAt,
      message: record.immutable
        ? `Immutable PDF archived (v${record.revision}).`
        : `Draft PDF generated (v${record.revision}).`,
    }));
    const rawEvents = [
      ...(invoice.activityLog ?? []),
      ...mapStatusHistoryToActivity(invoice.statusHistory),
      ...emailEvents,
      ...pdfEvents,
    ];
    const dedupedById = new Map<string, InvoiceActivityEvent>();
    rawEvents.forEach((event) => dedupedById.set(event.id, event));
    return Array.from(dedupedById.values()).sort((a, b) => b.at.localeCompare(a.at));
  }, [emailLogs, invoice.activityLog, invoice.statusHistory, pdfRecords]);

  const previewConfig = templateVersion?.config ?? createDefaultTemplateConfigForType('invoice');
  const previewPayload = buildPreviewPayloadFromInvoice({
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    lineItems: buildPreviewRowsFromDomainItems(invoice.items),
    totals,
    paidMinor,
    outstandingMinor,
    notes: invoice.notes,
    paymentTerms: invoice.termsAndConditions ?? invoice.paymentTerms,
    clientName: client?.displayName ?? invoice.clientId,
    clientContactName: client?.contactName,
    clientEmail: client?.email,
    clientPhone: client?.phone,
    clientAddressLines:
      invoice.billingAddressSnapshot
        ? mapAddressLines(invoice.billingAddressSnapshot)
        : mapAddressLines(client?.billingAddress),
    business: {
      name: 'DeveLogic Digital',
      contactName: 'Finance Team',
      email: 'accounts@develogic-digital.com',
      phone: '+27 11 555 0190',
      addressLines: ['Johannesburg', 'South Africa'],
    },
  });

  const customerRecipients = invoice.recipientEmails && invoice.recipientEmails.length > 0
    ? invoice.recipientEmails
    : client?.email
      ? [client.email]
      : [];

  const markInvoiceAsSent = () => {
    if (!actionAvailability.canMarkSent.allowed) {
      setNotice({ tone: 'warning', text: actionAvailability.canMarkSent.reason ?? 'Invoice cannot be marked as sent.' });
      return false;
    }

    const sentResult = transitionInvoice(invoice.id, 'sent', 'Marked as sent from invoice detail.');
    if (!sentResult.ok) {
      setNotice({ tone: 'error', text: sentResult.error ?? 'Unable to mark invoice as sent.' });
      return false;
    }

    setNotice({ tone: 'success', text: 'Invoice marked as sent.' });
    return true;
  };

  const handleDuplicate = () => {
    const result = duplicateInvoice(invoice.id);
    if (result.ok && result.data) {
      navigate(`/invoices/${result.data.id}/edit`);
      return;
    }

    setNotice({ tone: 'error', text: result.error ?? 'Unable to duplicate invoice.' });
  };

  const handleRecordPayment = (payload: {
    amount: number;
    paymentDate: string;
    method?: 'bank_transfer' | 'card' | 'cash' | 'mobile_money' | 'other';
    reference?: string;
    note?: string;
  }) => {
    const result = recordPayment(invoice.id, payload);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? 'Payment recorded.' : result.error ?? 'Unable to record payment.',
    });
    return result;
  };

  const handleGenerateDraftPdf = async () => {
    setIsGeneratingPdf(true);
    const result = await generateInvoicePdf(invoice.id, {
      generationMode: 'draft_preview',
      source: 'invoice_detail',
    });
    setIsGeneratingPdf(false);

    if (result.ok && result.data) {
      setNotice({ tone: 'success', text: `Draft PDF generated: ${result.data.file.fileName}` });
      return;
    }

    setNotice({ tone: 'error', text: result.error ?? 'Unable to generate draft PDF.' });
  };

  const handleArchivePdf = async () => {
    setIsGeneratingPdf(true);
    const result = await generateInvoicePdf(invoice.id, {
      generationMode: 'historical_archive',
      source: 'invoice_detail',
    });
    setIsGeneratingPdf(false);

    if (result.ok && result.data) {
      setNotice({ tone: 'success', text: `Archived PDF created: ${result.data.file.fileName}` });
      return;
    }

    setNotice({ tone: 'error', text: result.error ?? 'Unable to archive PDF.' });
  };

  const handleOpenPdf = (recordId?: string) => {
    if (!recordId) {
      setNotice({ tone: 'warning', text: 'No PDF record is available yet.' });
      return;
    }

    const result = openPdfRecord(recordId);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to open PDF.' });
    }
  };

  const handleDownloadPdf = (recordId?: string) => {
    if (!recordId) {
      setNotice({ tone: 'warning', text: 'No PDF record is available yet.' });
      return;
    }

    const result = downloadPdfRecord(recordId);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? 'PDF download started.' : result.error ?? 'Unable to download PDF.',
    });
  };

  const handleOpenSendDialog = () => {
    if (!canSendEmails) {
      setNotice({ tone: 'warning', text: emailAvailabilityMessage ?? 'Email sending is currently unavailable.' });
      return;
    }

    if (!actionAvailability.canSend.allowed) {
      setNotice({ tone: 'warning', text: actionAvailability.canSend.reason ?? 'Invoice cannot be sent right now.' });
      return;
    }

    const result = createComposeDraftForDocument({ documentType: 'invoice', documentId: invoice.id });
    if (!result.ok || !result.data) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to prepare email draft.' });
      return;
    }

    setComposeDraft(result.data);
    setComposeOpen(true);
  };

  const handleSendEmail = async () => {
    if (!composeDraft) return;
    setIsSendingEmail(true);
    const result = await sendEmailDraft(composeDraft);
    setIsSendingEmail(false);

    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to send invoice email.' });
      return;
    }

    setComposeOpen(false);
    setComposeDraft(null);

    if (invoice.status === 'draft' || invoice.status === 'approved') {
      void markInvoiceAsSent();
    }

    setNotice({
      tone: result.warning ? 'warning' : 'success',
      text: result.warning ?? 'Invoice email sent successfully.',
    });
  };

  const handleVoid = () => {
    if (!actionAvailability.canVoid.allowed) {
      setNotice({ tone: 'warning', text: actionAvailability.canVoid.reason ?? 'Invoice cannot be voided.' });
      return;
    }
    const result = transitionInvoice(invoice.id, 'void', 'Voided from invoice detail.');
    setNotice({
      tone: result.ok ? 'warning' : 'error',
      text: result.ok ? 'Invoice has been voided.' : result.error ?? 'Unable to void invoice.',
    });
  };

  const handleDelete = () => {
    if (!actionAvailability.canDelete.allowed) {
      setNotice({ tone: 'warning', text: actionAvailability.canDelete.reason ?? 'Invoice cannot be deleted.' });
      return;
    }
    const confirmed = window.confirm(`Delete invoice "${invoice.invoiceNumber}"?`);
    if (!confirmed) return;
    const result = deleteInvoice(invoice.id);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to delete invoice.' });
      return;
    }
    navigate('/invoices');
  };

  const handleRequestRecurring = () => {
    const allowed = canMakeInvoiceRecurring(invoice.status);
    if (!allowed.allowed) {
      setNotice({ tone: 'warning', text: allowed.reason ?? 'Recurring setup is unavailable.' });
      return;
    }
    const result = requestInvoiceRecurring(invoice.id);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok
        ? 'Recurring invoice profile created. Opening recurring invoices setup.'
        : result.error ?? 'Unable to request recurring invoice.',
    });
    if (result.ok) {
      navigate(`/invoices/recurring?invoiceId=${invoice.id}`);
    }
  };

  const handleCreateCreditNote = () => {
    const allowed = canCreateCreditNote(invoice.status);
    if (!allowed.allowed) {
      setNotice({ tone: 'warning', text: allowed.reason ?? 'Credit note action is unavailable.' });
      return;
    }
    const result = requestInvoiceCreditNote(invoice.id);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok
        ? 'Credit note request captured from this invoice context.'
        : result.error ?? 'Unable to request credit note.',
    });
  };

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    setIsUploadingAttachment(true);
    try {
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        const result = addInvoiceAttachment(invoice.id, {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          dataUrl,
        });
        if (!result.ok) {
          throw new Error(result.error ?? `Unable to attach ${file.name}`);
        }
      }
      setNotice({ tone: 'success', text: `${files.length} attachment(s) uploaded.` });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to upload attachment.',
      });
    } finally {
      setIsUploadingAttachment(false);
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = (attachment: InvoiceAttachment) => {
    const result = removeInvoiceAttachment(invoice.id, attachment.id);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? `${attachment.fileName} removed.` : result.error ?? 'Unable to remove attachment.',
    });
  };

  const handleSavePreferences = () => {
    setShowPreferencesModal(false);
    setNotice({ tone: 'success', text: 'Invoice preferences saved for this session.' });
  };

  const closeAndRun = (callback: () => void) => {
    setShowMoreMenu(false);
    callback();
  };

  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        subtitle={`${client?.displayName ?? 'Unknown customer'} · Invoice Date ${formatDate(invoice.issueDate)}`}
        actions={
          <>
            {actionAvailability.canEdit.allowed ? (
              <Link to={`/invoices/${invoice.id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={handleOpenSendDialog}
              disabled={!canSendEmails || emailCapabilityLoading || !actionAvailability.canSend.allowed}
              title={sendDisabledReason}
            >
              Send
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setViewMode((previous) => (previous === 'details' ? 'pdf' : 'details'))}
            >
              PDF/Detail
            </Button>
            {actionAvailability.canRecordPayment.allowed && outstandingMinor > 0 ? (
              <Button type="button" variant="primary" onClick={() => setShowPaymentForm((value) => !value)}>
                {showPaymentForm ? 'Close Payment' : 'Record Payment'}
              </Button>
            ) : null}
            <div className="dl-row-action-menu" ref={moreMenuRootRef}>
              <Button type="button" variant="ghost" onClick={() => setShowMoreMenu((previous) => !previous)}>
                More
              </Button>
              {showMoreMenu && moreMenuStyle
                ? createPortal(
                    <div
                      ref={moreMenuPopoverRef}
                      className="dl-row-action-popover"
                      role="menu"
                      aria-label="Invoice actions"
                      style={moreMenuStyle}
                    >
                      {actionAvailability.canMarkSent.allowed ? (
                        <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(markInvoiceAsSent)}>
                          Mark as Sent
                        </button>
                      ) : null}
                      <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(handleRequestRecurring)}>
                        Make Recurring
                      </button>
                      <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(handleCreateCreditNote)}>
                        Create Credit Note
                      </button>
                      <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(handleDuplicate)}>
                        Clone
                      </button>
                      {actionAvailability.canVoid.allowed ? (
                        <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(handleVoid)}>
                          Void
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="dl-row-action-item"
                        onClick={() =>
                          closeAndRun(() =>
                            setNotice({
                              tone: invoice.status === 'draft' ? 'info' : 'success',
                              text:
                                invoice.status === 'draft'
                                  ? 'Journal entries are available after an invoice is issued.'
                                  : 'Journal view hook is ready. Open full journal details in the accounting ledger module.',
                            }),
                          )
                        }
                      >
                        View Journal
                      </button>
                      <button
                        type="button"
                        className="dl-row-action-item"
                        onClick={() => closeAndRun(() => setShowPreferencesModal(true))}
                      >
                        Invoice Preferences
                      </button>
                      {actionAvailability.canDelete.allowed ? (
                        <button type="button" className="dl-row-action-item danger" onClick={() => closeAndRun(handleDelete)}>
                          Delete
                        </button>
                      ) : null}
                    </div>,
                    document.body,
                  )
                : null}
            </div>
            <IconButton icon="📎" label="Open attachments" onClick={() => setAttachmentsOpen((previous) => !previous)} />
          </>
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}
      {!canSendEmails && !emailCapabilityLoading ? (
        <InlineNotice tone="warning">{sendDisabledReason}</InlineNotice>
      ) : null}

      {invoice.status === 'draft' ? (
        <InlineNotice tone="info">
          <strong>What&apos;s next?</strong> Send this invoice to your customer or mark it as sent when delivered outside the app.
          <span className="dl-inline-actions" style={{ marginLeft: 8 }}>
            <Button size="sm" onClick={handleOpenSendDialog} disabled={!canSendEmails}>Send Invoice</Button>
            <Button size="sm" variant="secondary" onClick={markInvoiceAsSent}>Mark as Sent</Button>
          </span>
        </InlineNotice>
      ) : null}
      {(invoice.status === 'sent' || invoice.status === 'approved' || invoice.status === 'overdue' || invoice.status === 'partially_paid') ? (
        <InlineNotice tone={invoice.status === 'overdue' ? 'warning' : 'info'}>
          {invoice.status === 'overdue'
            ? 'This invoice is overdue. Record payment or follow up with the customer.'
            : 'Collect and record payment to keep receivables current.'}
          {actionAvailability.canRecordPayment.allowed && outstandingMinor > 0 ? (
            <span className="dl-inline-actions" style={{ marginLeft: 8 }}>
              <Button size="sm" onClick={() => setShowPaymentForm(true)}>Record Payment</Button>
            </span>
          ) : null}
        </InlineNotice>
      ) : null}
      {invoice.status === 'paid' ? (
        <InlineNotice tone="success">This invoice is fully settled. Journal visibility and archived delivery records remain available.</InlineNotice>
      ) : null}
      {invoice.status === 'void' ? (
        <InlineNotice tone="warning">This invoice has been voided and can no longer accept payments.</InlineNotice>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <Tabs tabs={DETAIL_TABS} activeKey={activeTab} onChange={(key) => setActiveTab(key as DetailTab)} />
      </div>

      {showPaymentForm ? (
        <div className="dl-page-section">
          <Card title="Record Payment" subtitle="Apply payment to this invoice">
            <RecordPaymentForm
              onSubmit={handleRecordPayment}
              onCancel={() => setShowPaymentForm(false)}
            />
          </Card>
        </div>
      ) : null}

      {activeTab === 'invoice_details' ? (
        <>
          <Card
            title={invoice.invoiceNumber}
            subtitle={`Total ${formatMinorCurrency(totals.totalMinor, invoice.currencyCode)} · Balance Due ${formatMinorCurrency(outstandingMinor, invoice.currencyCode)}`}
            rightSlot={
              <div className="dl-inline-actions">
                <Button
                  size="sm"
                  variant={viewMode === 'details' ? 'primary' : 'secondary'}
                  onClick={() => setViewMode('details')}
                >
                  Details
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'pdf' ? 'primary' : 'secondary'}
                  onClick={() => setViewMode('pdf')}
                >
                  PDF
                </Button>
              </div>
            }
          >
            {viewMode === 'pdf' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <TemplatePreviewRenderer config={previewConfig} payload={previewPayload} />
                <div className="dl-inline-actions">
                  <Button size="sm" variant="secondary" onClick={handleGenerateDraftPdf} disabled={isGeneratingPdf}>
                    {isGeneratingPdf ? 'Generating...' : 'Generate Draft PDF'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleArchivePdf} disabled={isGeneratingPdf}>
                    {isGeneratingPdf ? 'Generating...' : 'Archive Immutable PDF'}
                  </Button>
                  <Button size="sm" onClick={() => handleOpenPdf(latestPdf?.id)}>Open Latest PDF</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDownloadPdf(latestPdf?.id)}>Download Latest PDF</Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                <div className="dl-grid cols-2">
                  <div className="dl-meta-grid">
                    <div><strong>Invoice Number:</strong> {invoice.invoiceNumber}</div>
                    <div><strong>Order Number:</strong> {invoice.orderNumber || '—'}</div>
                    <div><strong>Invoice Date:</strong> {formatDate(invoice.issueDate)}</div>
                    <div><strong>Due Date:</strong> {formatDate(invoice.dueDate)}</div>
                    <div><strong>Terms:</strong> {invoice.paymentTerms || invoice.terms || '—'}</div>
                    <div><strong>Accounts Receivable:</strong> {invoice.accountsReceivableAccountId || '—'}</div>
                    <div><strong>Salesperson:</strong> {invoice.salesperson || '—'}</div>
                    <div><strong>Subject:</strong> {invoice.subject || '—'}</div>
                  </div>
                  <div className="dl-meta-grid">
                    <div><strong>Status:</strong> <InvoiceStatusBadge status={invoice.status} /></div>
                    <div><strong>Total Amount:</strong> {formatMinorCurrency(totals.totalMinor, invoice.currencyCode)}</div>
                    <div><strong>Paid Amount:</strong> {formatMinorCurrency(paidMinor, invoice.currencyCode)}</div>
                    <div><strong>Balance Due:</strong> {formatMinorCurrency(outstandingMinor, invoice.currencyCode)}</div>
                    <div><strong>Template:</strong> {invoice.templateName ?? template?.name ?? 'Not assigned'}</div>
                    <div><strong>Template Version:</strong> {templateVersion ? `v${templateVersion.versionNumber}` : 'Not assigned'}</div>
                    <div><strong>Source Quote:</strong> {invoice.sourceQuoteId ?? '—'}</div>
                    <div><strong>Creation Date:</strong> {formatDate(invoice.createdAt)}</div>
                  </div>
                </div>

                <div>
                  <h3 style={{ marginTop: 0 }}>Customer Details</h3>
                  <div className="dl-grid cols-2">
                    <div className="dl-meta-grid">
                      <div><strong>Name:</strong> {client?.displayName ?? invoice.clientId}</div>
                      <div><strong>Email:</strong> {client?.email || '—'}</div>
                      <div><strong>Phone:</strong> {client?.phone || '—'}</div>
                    </div>
                    <div className="dl-meta-grid">
                      <div><strong>Billing Address:</strong> {mapAddressLines(invoice.billingAddressSnapshot).join(', ') || '—'}</div>
                      <div><strong>Shipping Address:</strong> {mapAddressLines(invoice.shippingAddressSnapshot).join(', ') || '—'}</div>
                      <div><strong>Email Recipients:</strong> {customerRecipients.length > 0 ? customerRecipients.join(', ') : '—'}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ marginTop: 0 }}>Items</h3>
                  <DocumentLineItemsTable items={invoice.items} currencyCode={invoice.currencyCode} />
                </div>

                <div className="dl-grid cols-2">
                  <Card title="Totals">
                    <div className="dl-meta-grid">
                      <div><strong>Sub Total:</strong> {formatMinorCurrency(totals.subtotalMinor, invoice.currencyCode)}</div>
                      <div><strong>Adjustment:</strong> {formatMinorCurrency(totals.adjustmentMinor, invoice.currencyCode)}</div>
                      <div><strong>Total:</strong> {formatMinorCurrency(totals.totalMinor, invoice.currencyCode)}</div>
                      <div><strong>Balance Due:</strong> {formatMinorCurrency(outstandingMinor, invoice.currencyCode)}</div>
                    </div>
                  </Card>
                  <Card title="Document Delivery">
                    <div className="dl-meta-grid">
                      <div><strong>Latest Draft PDF:</strong> {latestDraftPdf ? latestDraftPdf.file.fileName : 'Not generated'}</div>
                      <div><strong>Latest Immutable PDF:</strong> {latestImmutablePdf ? latestImmutablePdf.file.fileName : 'Not archived'}</div>
                      <div><strong>Email Sends:</strong> {emailLogs.length}</div>
                    </div>
                  </Card>
                </div>

                <Card title="Customer Notes">
                  <p style={{ margin: 0 }}>{invoice.notes || 'No notes added.'}</p>
                </Card>
                <Card title="Terms & Conditions">
                  <p style={{ margin: 0 }}>{invoice.termsAndConditions ?? (invoice.paymentTerms || 'No terms provided.')}</p>
                </Card>
              </div>
            )}
          </Card>

          <div className="dl-page-section">
            <Card title="Email Delivery" subtitle="Recent sends and outcomes for this invoice">
              {recentEmailLogs.length === 0 ? (
                <p className="dl-muted" style={{ margin: 0 }}>No email sends recorded yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {recentEmailLogs.map((entry) => (
                    <div key={entry.id} style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{entry.recipient.to}</strong>
                        <EmailStatusBadge status={entry.status} />
                      </div>
                      <div className="dl-muted" style={{ fontSize: 12 }}>
                        {entry.subject} · {formatDate(entry.sentAt ?? entry.attemptedAt)}
                      </div>
                      {entry.errorMessage ? (
                        <div className="dl-muted" style={{ fontSize: 12 }}>
                          Error: {entry.errorMessage}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <div className="dl-inline-actions">
                    <Button
                      size="sm"
                      onClick={handleOpenSendDialog}
                      disabled={!canSendEmails || emailCapabilityLoading || !actionAvailability.canSend.allowed}
                      title={sendDisabledReason}
                    >
                      Compose and Send
                    </Button>
                    <Link to="/emails/history">
                      <Button size="sm" variant="secondary">
                        Open Email History
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="dl-grid cols-2 dl-page-section">
            <Card title="Payment History" subtitle="Applied payments">
              {payments.length === 0 ? (
                <p className="dl-muted" style={{ margin: 0 }}>No payments recorded yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {payments.map((payment) => (
                    <div key={payment.id} style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{formatMinorCurrency(payment.amountMinor, invoice.currencyCode)}</strong>
                        <span className="dl-muted">{formatDate(payment.paymentDate)}</span>
                      </div>
                      <div className="dl-muted" style={{ fontSize: 12 }}>
                        {(payment.method ?? 'Method not set').replace('_', ' ')}
                        {payment.reference ? ` · ${payment.reference}` : ''}
                        {payment.note ? ` · ${payment.note}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Journal">
              <p className="dl-muted" style={{ margin: 0 }}>
                {invoice.status === 'draft'
                  ? 'Journal entries are not created while an invoice is in draft.'
                  : 'Journal entry view hook is ready. Open the accounting journal module for full debit/credit detail.'}
              </p>
            </Card>
          </div>
        </>
      ) : null}

      {activeTab === 'activity_logs' ? (
        <Card title="Invoice Activity Log" subtitle="Chronological lifecycle, payment, send, and archive events">
          {orderedActivityEvents.length === 0 ? (
            <p className="dl-muted" style={{ margin: 0 }}>No activity recorded yet.</p>
          ) : (
            <div className="dl-timeline">
              {orderedActivityEvents.map((entry) => (
                <article className="dl-timeline-item" key={entry.id}>
                  <h3 className="dl-timeline-title">{entry.message}</h3>
                  <p className="dl-timeline-meta">
                    {formatDate(entry.at)} {entry.actor ? `· ${entry.actor}` : ''}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      <EmailComposeModal
        open={composeOpen}
        title="Send Invoice Email"
        draft={composeDraft}
        attachmentOptions={attachmentOptions}
        sending={isSendingEmail}
        sendDisabledReason={!canSendEmails ? emailAvailabilityMessage : undefined}
        onClose={() => {
          setComposeOpen(false);
          setComposeDraft(null);
        }}
        onChange={(draft) => setComposeDraft(draft)}
        onSend={handleSendEmail}
      />

      {attachmentsOpen ? (
        <RightSidePanel title="Attachments" onClose={() => setAttachmentsOpen(false)}>
          <div className="dl-inline-actions">
            <input
              type="file"
              id="invoice-detail-attachments"
              multiple
              style={{ display: 'none' }}
              onChange={(event) => void handleAttachmentUpload(event)}
              disabled={isUploadingAttachment}
            />
            <label htmlFor="invoice-detail-attachments">
              <Button size="sm" variant="secondary" disabled={isUploadingAttachment}>
                {isUploadingAttachment ? 'Uploading...' : 'Upload Files'}
              </Button>
            </label>
            <span className="dl-muted" style={{ fontSize: 12 }}>Maximum 5 files, 10MB each.</span>
          </div>

          <div className="dl-divider" />

          {(invoice.attachments ?? []).length === 0 ? (
            <p className="dl-muted">No files attached.</p>
          ) : (
            <div className="dl-card-list">
              {(invoice.attachments ?? []).map((attachment) => (
                <div key={attachment.id} className="dl-card-list-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <strong>{attachment.fileName}</strong>
                      <div className="dl-muted" style={{ fontSize: 12 }}>
                        {formatBytes(attachment.sizeBytes)}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleRemoveAttachment(attachment)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </RightSidePanel>
      ) : null}

      {showPreferencesModal ? (
        <InvoicePreferencesModal
          draft={preferencesDraft}
          onChange={setPreferencesDraft}
          onClose={() => setShowPreferencesModal(false)}
          onSave={handleSavePreferences}
        />
      ) : null}
    </>
  );
}

interface RightSidePanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function RightSidePanel({ title, onClose, children }: RightSidePanelProps) {
  return createPortal(
    <div className="dl-side-panel-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="dl-side-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="dl-side-panel-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </header>
        <div className="dl-side-panel-body">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

interface InvoicePreferencesModalProps {
  draft: InvoicePreferencesDraft;
  onChange: (next: InvoicePreferencesDraft) => void;
  onSave: () => void;
  onClose: () => void;
}

function InvoicePreferencesModal({ draft, onChange, onSave, onClose }: InvoicePreferencesModalProps) {
  return (
    <div className="dl-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="dl-modal" role="dialog" aria-modal="true" aria-label="Invoice preferences">
        <header className="dl-modal-header">
          <div>
            <h3 style={{ margin: 0 }}>Invoice Preferences</h3>
            <p className="dl-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              Configure discount and rounding behavior for invoicing workflows.
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </header>
        <div className="dl-modal-body" style={{ display: 'grid', gap: 14 }}>
          <div>
            <strong style={{ display: 'block', marginBottom: 8 }}>Discounts</strong>
            <label className="dl-checkbox">
              <input
                type="radio"
                name="invoice-discount-mode"
                checked={draft.discountMode === 'line'}
                onChange={() => onChange({ ...draft, discountMode: 'line' })}
              />
              <span>At line item level</span>
            </label>
            <label className="dl-checkbox">
              <input
                type="radio"
                name="invoice-discount-mode"
                checked={draft.discountMode === 'transaction'}
                onChange={() => onChange({ ...draft, discountMode: 'transaction' })}
              />
              <span>At transaction level</span>
            </label>
          </div>

          <div>
            <strong style={{ display: 'block', marginBottom: 8 }}>Rounding</strong>
            <label className="dl-checkbox">
              <input
                type="radio"
                name="invoice-rounding-mode"
                checked={draft.roundingMode === 'none'}
                onChange={() => onChange({ ...draft, roundingMode: 'none' })}
              />
              <span>No rounding</span>
            </label>
            <label className="dl-checkbox">
              <input
                type="radio"
                name="invoice-rounding-mode"
                checked={draft.roundingMode === 'nearest_whole'}
                onChange={() => onChange({ ...draft, roundingMode: 'nearest_whole' })}
              />
              <span>Round to nearest whole number</span>
            </label>
            <label className="dl-checkbox">
              <input
                type="radio"
                name="invoice-rounding-mode"
                checked={draft.roundingMode === 'nearest_increment'}
                onChange={() => onChange({ ...draft, roundingMode: 'nearest_increment' })}
              />
              <span>Round to nearest incremental value</span>
            </label>
          </div>

          <label className="dl-checkbox">
            <input
              type="checkbox"
              checked={draft.showSalesperson}
              onChange={(event) => onChange({ ...draft, showSalesperson: event.target.checked })}
            />
            <span>Show salesperson field on invoice forms</span>
          </label>
        </div>
        <footer className="dl-modal-footer">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSave}>Save Preferences</Button>
        </footer>
      </div>
    </div>
  );
}
