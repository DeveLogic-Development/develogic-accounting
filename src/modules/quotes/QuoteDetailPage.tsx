import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { EmailStatusBadge } from '@/design-system/patterns/StatusBadge';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { Tabs } from '@/design-system/primitives/Tabs';
import { Textarea } from '@/design-system/primitives/Textarea';
import { formatBytes, formatDate, formatMinorCurrency } from '@/utils/format';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { useTemplates } from '@/modules/templates/hooks/useTemplates';
import { calculateDocumentTotals } from '@/modules/accounting/domain/calculations';
import { canEditQuote, getAllowedQuoteTransitions } from '@/modules/accounting/domain/quote-rules';
import { DocumentLineItemsTable } from '@/modules/accounting/components/DocumentLineItemsTable';
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';
import { useEmails } from '@/modules/emails/hooks/useEmails';
import { EmailComposeModal } from '@/modules/emails/components/EmailComposeModal';
import { EmailComposeDraft } from '@/modules/emails/domain/types';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { IconButton } from '@/design-system/primitives/IconButton';
import { QuoteActivityEvent, QuoteAttachment, QuoteConversionPreferences, StatusEvent } from '@/modules/accounting/domain/types';
import { createDefaultTemplateConfigForType } from '@/modules/templates/domain/defaults';
import { buildPreviewPayloadFromQuote, buildPreviewRowsFromDomainItems } from '@/modules/templates/domain/preview-builders';
import { TemplatePreviewRenderer } from '@/modules/templates/components/TemplatePreviewRenderer';

type DetailTab = 'quote_details' | 'activity_logs';
type DocumentViewMode = 'details' | 'pdf';

const DETAIL_TABS: Array<{ key: DetailTab; label: string }> = [
  { key: 'quote_details', label: 'Quote Details' },
  { key: 'activity_logs', label: 'Activity Logs' },
];

const DEFAULT_CONVERSION_PREFERENCES: QuoteConversionPreferences = {
  carryCustomerNotes: true,
  carryTermsAndConditions: true,
  carryAddresses: true,
};

function normalizeConversionPreferences(
  input?: Partial<QuoteConversionPreferences>,
): QuoteConversionPreferences {
  return {
    ...DEFAULT_CONVERSION_PREFERENCES,
    ...(input ?? {}),
  };
}

function areConversionPreferencesEqual(
  a: QuoteConversionPreferences,
  b: QuoteConversionPreferences,
): boolean {
  return (
    a.carryCustomerNotes === b.carryCustomerNotes &&
    a.carryTermsAndConditions === b.carryTermsAndConditions &&
    a.carryAddresses === b.carryAddresses
  );
}

function mapStatusHistoryToActivity(entries: StatusEvent<string>[]): QuoteActivityEvent[] {
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

export function QuoteDetailPage() {
  const navigate = useNavigate();
  const { quoteId } = useParams();
  const {
    getQuoteById,
    transitionQuote,
    convertQuoteToInvoice,
    duplicateQuote,
    deleteQuote,
    addQuoteComment,
    addQuoteAttachment,
    removeQuoteAttachment,
    updateQuoteConversionPreferences,
  } = useAccounting();
  const { getTemplateById, getTemplateVersionById } = useTemplates();
  const { generateQuotePdf, getPdfRecordsForDocument, openPdfRecord, downloadPdfRecord } = usePdfArchive();
  const {
    getLogsForDocument,
    createComposeDraftForDocument,
    sendEmailDraft,
    canSendEmails,
    emailCapabilityLoading,
    emailAvailabilityMessage,
  } = useEmails();
  const { getClientById } = useMasterData();

  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('quote_details');
  const [viewMode, setViewMode] = useState<DocumentViewMode>('details');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<EmailComposeDraft | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [moreMenuStyle, setMoreMenuStyle] = useState<CSSProperties | null>(null);
  const [showConversionPreferences, setShowConversionPreferences] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );
  const [conversionPrefsDraft, setConversionPrefsDraft] = useState<QuoteConversionPreferences>(
    DEFAULT_CONVERSION_PREFERENCES,
  );

  const moreMenuRootRef = useRef<HTMLDivElement | null>(null);
  const moreMenuPopoverRef = useRef<HTMLDivElement | null>(null);

  const quote = quoteId ? getQuoteById(quoteId) : undefined;

  useEffect(() => {
    if (!quote) return;
    const nextPreferences = normalizeConversionPreferences(quote.conversionPreferences);
    setConversionPrefsDraft((previous) =>
      areConversionPreferencesEqual(previous, nextPreferences) ? previous : nextPreferences,
    );
  }, [
    quote?.id,
    quote?.conversionPreferences?.carryCustomerNotes,
    quote?.conversionPreferences?.carryTermsAndConditions,
    quote?.conversionPreferences?.carryAddresses,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobileViewport(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!showMoreMenu) return;
    const updatePopoverPosition = () => {
      if (!moreMenuRootRef.current) return;
      const triggerRect = moreMenuRootRef.current.getBoundingClientRect();
      const menuWidth = 220;
      const estimatedMenuHeight = 210;
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

  if (!quote) {
    return (
      <EmptyState
        title="Quote not found"
        description="The quote may have been deleted or is unavailable."
        action={
          <Link to="/quotes">
            <Button variant="primary">Back to Quotes</Button>
          </Link>
        }
      />
    );
  }

  const totals = calculateDocumentTotals(quote.items, quote.documentDiscountPercent, quote.adjustmentMinor ?? 0);
  const client = getClientById(quote.clientId);
  const template = getTemplateById(quote.templateId ?? '');
  const templateVersion = getTemplateVersionById(quote.templateVersionId);
  const editable = canEditQuote(quote.status).allowed;
  const transitions = getAllowedQuoteTransitions(quote.status);
  const pdfRecords = getPdfRecordsForDocument({ documentType: 'quote', documentId: quote.id });
  const latestPdf = pdfRecords[0];
  const latestImmutablePdf = pdfRecords.find((record) => record.immutable);
  const latestDraftPdf = pdfRecords.find((record) => !record.immutable);
  const emailLogs = getLogsForDocument({ documentType: 'quote', documentId: quote.id });
  const recentEmailLogs = emailLogs.slice(0, 3);
  const sendDisabledReason = emailCapabilityLoading
    ? 'Checking email capability...'
    : !canSendEmails
      ? (emailAvailabilityMessage ?? 'Email sending is currently unavailable.')
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
    const emailEvents: QuoteActivityEvent[] = emailLogs.map((entry) => ({
      id: `email_${entry.id}`,
      event: 'emailed',
      at: entry.sentAt ?? entry.attemptedAt,
      message:
        entry.status === 'sent'
          ? `Quote emailed to ${entry.recipient.to}.`
          : `Quote email ${entry.status}${entry.errorMessage ? ` · ${entry.errorMessage}` : ''}.`,
    }));
    const pdfEvents: QuoteActivityEvent[] = pdfRecords.map((record) => ({
      id: `pdf_${record.id}`,
      event: 'updated',
      at: record.generatedAt,
      message: record.immutable
        ? `Immutable PDF archived (v${record.revision}).`
        : `Draft PDF generated (v${record.revision}).`,
    }));
    const rawEvents = [
      ...(quote.activityLog ?? []),
      ...mapStatusHistoryToActivity(quote.statusHistory),
      ...emailEvents,
      ...pdfEvents,
    ];
    const dedupedById = new Map<string, QuoteActivityEvent>();
    rawEvents.forEach((event) => dedupedById.set(event.id, event));
    return Array.from(dedupedById.values()).sort((a, b) => b.at.localeCompare(a.at));
  }, [emailLogs, pdfRecords, quote.activityLog, quote.statusHistory]);

  const previewConfig = templateVersion?.config ?? createDefaultTemplateConfigForType('quote');
  const previewPayload = buildPreviewPayloadFromQuote({
    quoteNumber: quote.quoteNumber,
    issueDate: quote.issueDate,
    expiryDate: quote.expiryDate,
    lineItems: buildPreviewRowsFromDomainItems(quote.items),
    totals,
    notes: quote.notes,
    paymentTerms: quote.termsAndConditions ?? quote.paymentTerms,
    clientName: client?.displayName ?? quote.clientId,
    clientContactName: client?.contactName,
    clientEmail: client?.email,
    clientPhone: client?.phone,
    clientAddressLines:
      quote.billingAddressSnapshot
        ? mapAddressLines(quote.billingAddressSnapshot)
        : mapAddressLines(client?.billingAddress),
    business: {
      name: 'DeveLogic Digital',
      contactName: 'Finance Team',
      email: 'accounts@develogic-digital.com',
      phone: '+27 11 555 0190',
      addressLines: ['Johannesburg', 'South Africa'],
    },
  });

  const customerRecipients = quote.recipientEmails && quote.recipientEmails.length > 0
    ? quote.recipientEmails
    : client?.email
      ? [client.email]
      : [];

  const handleTransition = (target: 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired') => {
    const result = transitionQuote(quote.id, target);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? `Quote marked as ${target.replace('_', ' ')}.` : result.error ?? 'Action failed.',
    });
  };

  const handleConvert = () => {
    const result = convertQuoteToInvoice(quote.id, conversionPrefsDraft);
    if (result.ok && result.data) {
      setShowConversionPreferences(false);
      navigate(`/invoices/${result.data.id}`);
      return;
    }
    setNotice({ tone: 'error', text: result.error ?? 'Unable to convert quote.' });
  };

  const handleDuplicate = () => {
    const result = duplicateQuote(quote.id);
    if (result.ok && result.data) {
      navigate(`/quotes/${result.data.id}/edit`);
      return;
    }
    setNotice({ tone: 'error', text: result.error ?? 'Unable to duplicate quote.' });
  };

  const handleDelete = () => {
    const confirmed = window.confirm(`Delete quote "${quote.quoteNumber}"?`);
    if (!confirmed) return;
    const result = deleteQuote(quote.id);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to delete quote.' });
      return;
    }
    navigate('/quotes');
  };

  const handleGenerateDraftPdf = async () => {
    setIsGeneratingPdf(true);
    const result = await generateQuotePdf(quote.id, {
      generationMode: 'draft_preview',
      source: 'quote_detail',
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
    const result = await generateQuotePdf(quote.id, {
      generationMode: 'historical_archive',
      source: 'quote_detail',
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

    const result = createComposeDraftForDocument({ documentType: 'quote', documentId: quote.id });
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
      setNotice({ tone: 'error', text: result.error ?? 'Unable to send quote email.' });
      return;
    }

    setComposeOpen(false);
    setComposeDraft(null);
    setNotice({
      tone: result.warning ? 'warning' : 'success',
      text: result.warning ?? 'Quote email sent successfully.',
    });
  };

  const handleAddComment = () => {
    const result = addQuoteComment(quote.id, commentDraft);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to add comment.' });
      return;
    }
    setCommentDraft('');
    setNotice({ tone: 'success', text: 'Comment added.' });
    setActiveTab('activity_logs');
  };

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    setIsUploadingAttachment(true);
    try {
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        const result = addQuoteAttachment(quote.id, {
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

  const handleRemoveAttachment = (attachment: QuoteAttachment) => {
    const result = removeQuoteAttachment(quote.id, attachment.id);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? `${attachment.fileName} removed.` : result.error ?? 'Unable to remove attachment.',
    });
  };

  const handleSaveConversionPreferences = () => {
    const result = updateQuoteConversionPreferences(quote.id, conversionPrefsDraft);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? 'Conversion preferences updated.' : result.error ?? 'Unable to save preferences.',
    });
    if (result.ok) setShowConversionPreferences(false);
  };

  const closeAndRun = (callback: () => void) => {
    setShowMoreMenu(false);
    callback();
  };

  return (
    <div className="dl-quote-detail-page dl-document-detail-page">
      <PageHeader
        title={quote.quoteNumber}
        subtitle={`${client?.displayName ?? 'Unknown customer'} · Quote Date ${formatDate(quote.issueDate)}`}
        actions={
          <>
            {editable ? (
              <Link to={`/quotes/${quote.id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
            ) : null}
            <Button type="button" variant="secondary" onClick={handleOpenSendDialog} disabled={!canSendEmails || emailCapabilityLoading}>
              Mails
            </Button>
            <Button type="button" variant="secondary" onClick={() => setViewMode((prev) => (prev === 'details' ? 'pdf' : 'details'))}>
              PDF/Detail
            </Button>
            {quote.status === 'accepted' ? (
              <Button type="button" variant="primary" onClick={() => setShowConversionPreferences(true)}>
                Convert to Invoice
              </Button>
            ) : null}
            <div className="dl-row-action-menu" ref={moreMenuRootRef}>
              <Button type="button" variant="ghost" onClick={() => setShowMoreMenu((prev) => !prev)}>
                More
              </Button>
              {showMoreMenu && moreMenuStyle
                ? createPortal(
                    <div
                      ref={moreMenuPopoverRef}
                      className="dl-row-action-popover"
                      role="menu"
                      aria-label="Quote actions"
                      style={moreMenuStyle}
                    >
                      {quote.status === 'draft' ? (
                        <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(() => handleTransition('sent'))}>
                          Mark as Sent
                        </button>
                      ) : null}
                      {transitions.includes('viewed') ? (
                        <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(() => handleTransition('viewed'))}>
                          Mark as Viewed
                        </button>
                      ) : null}
                      {transitions.includes('accepted') ? (
                        <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(() => handleTransition('accepted'))}>
                          Accept Quote
                        </button>
                      ) : null}
                      {transitions.includes('rejected') ? (
                        <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(() => handleTransition('rejected'))}>
                          Reject Quote
                        </button>
                      ) : null}
                      {transitions.includes('expired') ? (
                        <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(() => handleTransition('expired'))}>
                          Expire Quote
                        </button>
                      ) : null}
                      <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(handleDuplicate)}>
                        Clone
                      </button>
                      <button
                        type="button"
                        className="dl-row-action-item"
                        onClick={() => closeAndRun(() => setShowConversionPreferences(true))}
                      >
                        Quote Preferences
                      </button>
                      <button type="button" className="dl-row-action-item danger" onClick={() => closeAndRun(handleDelete)}>
                        Delete
                      </button>
                    </div>,
                    document.body,
                  )
                : null}
            </div>
            <IconButton icon="💬" label="Open comments" onClick={() => setCommentsOpen((prev) => !prev)} />
            <IconButton icon="📎" label="Open attachments" onClick={() => setAttachmentsOpen((prev) => !prev)} />
          </>
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}
      {!canSendEmails && !emailCapabilityLoading ? (
        <InlineNotice tone="warning">{sendDisabledReason}</InlineNotice>
      ) : null}

      {quote.status === 'draft' ? (
        <InlineNotice tone="info">
          <strong>What&apos;s next?</strong> Go ahead and email this quote to your customer or simply mark it as sent.
          <span className="dl-inline-actions" style={{ marginLeft: 8 }}>
            <Button size="sm" onClick={handleOpenSendDialog} disabled={!canSendEmails}>Send Quote</Button>
            <Button size="sm" variant="secondary" onClick={() => handleTransition('sent')}>Mark as Sent</Button>
          </span>
        </InlineNotice>
      ) : null}
      {quote.status === 'accepted' ? (
        <InlineNotice tone="success">
          This quote has been accepted. Convert it to an invoice to continue the sales workflow.
          <span className="dl-inline-actions" style={{ marginLeft: 8 }}>
            <Button size="sm" onClick={() => setShowConversionPreferences(true)}>Convert to Invoice</Button>
          </span>
        </InlineNotice>
      ) : null}
      {quote.status === 'converted' && quote.convertedInvoiceId ? (
        <InlineNotice tone="info">
          This quote was converted to invoice.
          <span className="dl-inline-actions" style={{ marginLeft: 8 }}>
            <Link to={`/invoices/${quote.convertedInvoiceId}`}>
              <Button size="sm" variant="secondary">Open Invoice</Button>
            </Link>
          </span>
        </InlineNotice>
      ) : null}

      <div className="dl-document-tabs-wrap">
        <Tabs tabs={DETAIL_TABS} activeKey={activeTab} onChange={(key) => setActiveTab(key as DetailTab)} />
      </div>

      {activeTab === 'quote_details' ? (
        <>
          <Card
            title={`${quote.quoteNumber}`}
            subtitle={`Total ${formatMinorCurrency(totals.totalMinor, quote.currencyCode)} · Status ${quote.status}`}
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
            {viewMode === 'details' ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <div className="dl-grid cols-2">
                  <div className="dl-meta-grid">
                    <div><strong>Quote Number:</strong> {quote.quoteNumber}</div>
                    <div><strong>Reference Number:</strong> {quote.referenceNumber || '—'}</div>
                    <div><strong>Quote Date:</strong> {formatDate(quote.issueDate)}</div>
                    <div><strong>Expiry Date:</strong> {formatDate(quote.expiryDate)}</div>
                    <div><strong>Salesperson:</strong> {quote.salesperson || '—'}</div>
                    <div><strong>Project:</strong> {quote.projectName || '—'}</div>
                    <div><strong>Subject:</strong> {quote.subject || '—'}</div>
                  </div>
                  <div className="dl-meta-grid">
                    <div><strong>Template:</strong> {quote.templateName ?? template?.name ?? 'Not assigned'}</div>
                    <div><strong>Template Version:</strong> {templateVersion ? `v${templateVersion.versionNumber}` : 'Not assigned'}</div>
                    <div><strong>Creation Date:</strong> {formatDate(quote.createdAt)}</div>
                    <div><strong>Billing Address:</strong> {mapAddressLines(quote.billingAddressSnapshot).join(', ') || '—'}</div>
                    <div><strong>Shipping Address:</strong> {mapAddressLines(quote.shippingAddressSnapshot).join(', ') || '—'}</div>
                  </div>
                </div>

                <div>
                  <h3 style={{ marginTop: 0 }}>Customer Details</h3>
                  <div className="dl-grid cols-2">
                    <div className="dl-meta-grid">
                      <div><strong>Name:</strong> {client?.displayName ?? quote.clientId}</div>
                      <div><strong>Email:</strong> {client?.email || '—'}</div>
                      <div><strong>Phone:</strong> {client?.phone || '—'}</div>
                    </div>
                    <div className="dl-meta-grid">
                      <div><strong>Email Recipients:</strong> {customerRecipients.length > 0 ? customerRecipients.join(', ') : '—'}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ marginTop: 0 }}>Items</h3>
                  <DocumentLineItemsTable items={quote.items} currencyCode={quote.currencyCode} />
                </div>

                <div className="dl-grid cols-2">
                  <Card title="Totals">
                    <div className="dl-meta-grid">
                      <div><strong>Sub Total:</strong> {formatMinorCurrency(totals.subtotalMinor, quote.currencyCode)}</div>
                      <div><strong>Adjustment:</strong> {formatMinorCurrency(totals.adjustmentMinor, quote.currencyCode)}</div>
                      <div><strong>Total:</strong> {formatMinorCurrency(totals.totalMinor, quote.currencyCode)}</div>
                    </div>
                  </Card>
                  <Card title="Send & Archive Summary">
                    <div className="dl-meta-grid">
                      <div><strong>Latest Draft PDF:</strong> {latestDraftPdf ? latestDraftPdf.file.fileName : 'Not generated'}</div>
                      <div><strong>Latest Immutable PDF:</strong> {latestImmutablePdf ? latestImmutablePdf.file.fileName : 'Not archived'}</div>
                      <div><strong>Email Sends:</strong> {emailLogs.length}</div>
                    </div>
                  </Card>
                </div>

                <Card title="Customer Notes">
                  <p style={{ margin: 0 }}>{quote.notes || 'No notes added.'}</p>
                </Card>
                <Card title="Terms & Conditions">
                  <p style={{ margin: 0 }}>{quote.termsAndConditions ?? (quote.paymentTerms || 'No terms provided.')}</p>
                </Card>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {isMobileViewport ? (
                  <div className="dl-preview-pane dl-mobile-preview-fallback" style={{ minHeight: 180, padding: 14 }}>
                    <div style={{ display: 'grid', gap: 8, textAlign: 'center' }}>
                      <strong>Inline PDF preview is limited on mobile browsers.</strong>
                      <span>Use Open Latest PDF or Download Latest PDF to preview this quote.</span>
                    </div>
                  </div>
                ) : (
                  <TemplatePreviewRenderer config={previewConfig} payload={previewPayload} />
                )}
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
            )}
          </Card>

          <div className="dl-page-section">
            <Card title="Email Delivery" subtitle="Recent sends and outcomes for this quote">
              {recentEmailLogs.length === 0 ? (
                <p className="dl-muted" style={{ margin: 0 }}>No email sends recorded yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {recentEmailLogs.map((entry) => (
                    <div key={entry.id} style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: 8 }}>
                      <div className="dl-responsive-split-row">
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
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}

      {activeTab === 'activity_logs' ? (
        <Card title="Quote Activity Log" subtitle="Chronological changes, sends, comments, and lifecycle events">
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
        title="Send Quote Email"
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

      {commentsOpen ? (
        <RightSidePanel title="Comments" onClose={() => setCommentsOpen(false)}>
          <Textarea
            label="Add Comment"
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            placeholder="Add an internal quote comment..."
            style={{ minHeight: 120 }}
          />
          <div className="dl-inline-actions">
            <Button size="sm" onClick={handleAddComment}>Add Comment</Button>
          </div>

          <div className="dl-divider" />

          {(quote.comments ?? []).length === 0 ? (
            <p className="dl-muted">No comments yet.</p>
          ) : (
            <div className="dl-timeline">
              {(quote.comments ?? []).map((comment) => (
                <article className="dl-timeline-item" key={comment.id}>
                  <h3 className="dl-timeline-title">Internal Comment</h3>
                  <p style={{ margin: '4px 0 0' }}>{comment.body}</p>
                  <p className="dl-timeline-meta">
                    {formatDate(comment.createdAt)} {comment.createdBy ? `· ${comment.createdBy}` : ''}
                  </p>
                </article>
              ))}
            </div>
          )}
        </RightSidePanel>
      ) : null}

      {attachmentsOpen ? (
        <RightSidePanel title="Attachments" onClose={() => setAttachmentsOpen(false)}>
          <div className="dl-inline-actions">
            <input
              type="file"
              id="quote-detail-attachments"
              multiple
              style={{ display: 'none' }}
              onChange={(event) => void handleAttachmentUpload(event)}
              disabled={isUploadingAttachment}
            />
            <label htmlFor="quote-detail-attachments">
              <Button size="sm" variant="secondary" disabled={isUploadingAttachment}>
                {isUploadingAttachment ? 'Uploading...' : 'Upload Files'}
              </Button>
            </label>
            <span className="dl-muted" style={{ fontSize: 12 }}>Maximum 5 files, 10MB each.</span>
          </div>

          <div className="dl-divider" />

          {(quote.attachments ?? []).length === 0 ? (
            <p className="dl-muted">No files attached.</p>
          ) : (
            <div className="dl-card-list">
              {(quote.attachments ?? []).map((attachment) => (
                <div key={attachment.id} className="dl-card-list-item">
                  <div className="dl-responsive-split-row">
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

      {showConversionPreferences ? (
        <ConversionPreferencesModal
          preferences={conversionPrefsDraft}
          onChange={setConversionPrefsDraft}
          onClose={() => setShowConversionPreferences(false)}
          onSave={handleSaveConversionPreferences}
          onConvert={handleConvert}
        />
      ) : null}
    </div>
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

interface ConversionPreferencesModalProps {
  preferences: QuoteConversionPreferences;
  onChange: (value: QuoteConversionPreferences) => void;
  onSave: () => void;
  onConvert: () => void;
  onClose: () => void;
}

function ConversionPreferencesModal({
  preferences,
  onChange,
  onSave,
  onConvert,
  onClose,
}: ConversionPreferencesModalProps) {
  return (
    <div className="dl-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="dl-modal" role="dialog" aria-modal="true" aria-label="Quote conversion preferences">
        <header className="dl-modal-header">
          <div>
            <h3 style={{ margin: 0 }}>Quote Conversion Preferences</h3>
            <p className="dl-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              Choose which fields to retain when converting this quote to an invoice.
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </header>
        <div className="dl-modal-body">
          <label className="dl-checkbox">
            <input
              type="checkbox"
              checked={preferences.carryCustomerNotes}
              onChange={(event) =>
                onChange({ ...preferences, carryCustomerNotes: event.target.checked })
              }
            />
            <span>Customer Notes</span>
          </label>
          <label className="dl-checkbox">
            <input
              type="checkbox"
              checked={preferences.carryTermsAndConditions}
              onChange={(event) =>
                onChange({ ...preferences, carryTermsAndConditions: event.target.checked })
              }
            />
            <span>Terms &amp; Conditions</span>
          </label>
          <label className="dl-checkbox">
            <input
              type="checkbox"
              checked={preferences.carryAddresses}
              onChange={(event) =>
                onChange({ ...preferences, carryAddresses: event.target.checked })
              }
            />
            <span>Billing and Shipping Address Snapshots</span>
          </label>
        </div>
        <footer className="dl-modal-footer">
          <Button variant="secondary" onClick={onSave}>Save Preferences</Button>
          <Button variant="primary" onClick={onConvert}>Save & Convert</Button>
        </footer>
      </div>
    </div>
  );
}
