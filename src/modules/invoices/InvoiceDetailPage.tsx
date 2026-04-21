import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { EmailStatusBadge, InvoiceStatusBadge } from '@/design-system/patterns/StatusBadge';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { formatBytes, formatDate, formatMinorCurrency } from '@/utils/format';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { useTemplates } from '@/modules/templates/hooks/useTemplates';
import { calculateDocumentTotals } from '@/modules/accounting/domain/calculations';
import {
  canEditInvoice,
  getAllowedInvoiceManualTransitions,
} from '@/modules/accounting/domain/invoice-rules';
import { DocumentLineItemsTable } from '@/modules/accounting/components/DocumentLineItemsTable';
import { DocumentStatusTimeline } from '@/modules/accounting/components/DocumentStatusTimeline';
import { RecordPaymentForm } from '@/modules/accounting/components/RecordPaymentForm';
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';
import { useEmails } from '@/modules/emails/hooks/useEmails';
import { EmailComposeModal } from '@/modules/emails/components/EmailComposeModal';
import { EmailComposeDraft } from '@/modules/emails/domain/types';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';

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

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<EmailComposeDraft | null>(null);

  const invoice = invoiceId ? getInvoiceById(invoiceId) : undefined;

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

  const totals = calculateDocumentTotals(invoice.items, invoice.documentDiscountPercent);
  const paymentSummary = getInvoicePaymentSummary(invoice.id);
  const paidMinor = paymentSummary?.paidMinor ?? 0;
  const outstandingMinor = paymentSummary?.outstandingMinor ?? totals.totalMinor;
  const payments = getInvoicePayments(invoice.id);

  const client = getClientById(invoice.clientId);
  const template = getTemplateById(invoice.templateId ?? '');
  const templateVersion = getTemplateVersionById(invoice.templateVersionId);
  const editable = canEditInvoice(invoice.status).allowed;
  const transitions = getAllowedInvoiceManualTransitions(invoice.status);
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
      : undefined;

  const canRecordPayment = invoice.status !== 'void' && invoice.status !== 'draft' && outstandingMinor > 0;

  const transitionButtons = useMemo(
    () =>
      transitions.map((status) => ({
        status,
        label: status === 'approved' ? 'Approve/Open' : status === 'void' ? 'Void Invoice' : 'Mark as Sent',
      })),
    [transitions],
  );
  const attachmentOptions = useMemo(
    () =>
      pdfRecords.map((record) => ({
        value: record.id,
        label: `v${record.revision} · ${record.file.fileName} ${record.immutable ? '(Immutable)' : '(Draft)'}`,
      })),
    [pdfRecords],
  );

  const handleTransition = (target: 'approved' | 'sent' | 'void') => {
    const result = transitionInvoice(invoice.id, target);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? `Invoice marked as ${target}.` : result.error ?? 'Action failed.',
    });
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
    setNotice({
      tone: result.warning ? 'warning' : 'success',
      text: result.warning ?? 'Invoice email sent successfully.',
    });
  };

  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        subtitle={`${client?.name ?? 'Unknown client'} · Issued ${formatDate(invoice.issueDate)}`}
        actions={
          <>
            {editable ? (
              <Link to={`/invoices/${invoice.id}/edit`}>
                <Button variant="secondary">Edit Invoice</Button>
              </Link>
            ) : null}
            <Button type="button" onClick={handleDuplicate}>
              Duplicate
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleOpenSendDialog}
              disabled={!canSendEmails || emailCapabilityLoading}
              title={sendDisabledReason}
            >
              {emailCapabilityLoading ? 'Checking Email...' : 'Send Invoice Email'}
            </Button>
            {invoice.status === 'draft' ? (
              <Button type="button" variant="secondary" onClick={handleGenerateDraftPdf} disabled={isGeneratingPdf}>
                {isGeneratingPdf ? 'Generating PDF...' : 'Generate Draft PDF'}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={handleArchivePdf} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? 'Generating PDF...' : 'Archive PDF Snapshot'}
            </Button>
            {canRecordPayment ? (
              <Button type="button" variant="primary" onClick={() => setShowPaymentForm((value) => !value)}>
                {showPaymentForm ? 'Close Payment Form' : 'Record Payment'}
              </Button>
            ) : null}
          </>
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <div className="dl-grid cols-3">
        <Card title="Status">
          <InvoiceStatusBadge status={invoice.status} />
          {transitionButtons.length > 0 ? (
            <div className="dl-status-actions" style={{ marginTop: 12 }}>
              {transitionButtons.map((entry) => (
                <Button
                  key={entry.status}
                  size="sm"
                  type="button"
                  onClick={() => handleTransition(entry.status as 'approved' | 'sent' | 'void')}
                >
                  {entry.label}
                </Button>
              ))}
            </div>
          ) : null}
        </Card>
        <Card title="Total">
          <p className="dl-stat-value">{formatMinorCurrency(totals.totalMinor, invoice.currencyCode)}</p>
          <p className="dl-stat-meta">Calculated from current line items</p>
        </Card>
        <Card title="Outstanding">
          <p className="dl-stat-value" style={{ fontSize: 22 }}>
            {formatMinorCurrency(outstandingMinor, invoice.currencyCode)}
          </p>
          <p className="dl-stat-meta">Due {formatDate(invoice.dueDate)}</p>
        </Card>
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

      <div className="dl-grid cols-2 dl-page-section">
        <Card title="Client Details" subtitle="Billing contact">
          <div style={{ display: 'grid', gap: 8 }}>
            <div>{client?.contactName ?? 'N/A'}</div>
            <div className="dl-muted">{client?.email ?? 'N/A'}</div>
            <div className="dl-muted">{client?.phone ?? 'N/A'}</div>
            <div className="dl-muted">Payment terms: {invoice.paymentTerms || 'None'}</div>
          </div>
        </Card>

        <Card title="Payment Snapshot">
          <div style={{ display: 'grid', gap: 8 }}>
            <div>Total: {formatMinorCurrency(totals.totalMinor, invoice.currencyCode)}</div>
            <div>Paid: {formatMinorCurrency(paidMinor, invoice.currencyCode)}</div>
            <div>Outstanding: {formatMinorCurrency(outstandingMinor, invoice.currencyCode)}</div>
            <div>
              Template: {invoice.templateName ?? template?.name ?? 'Not assigned'}{' '}
              {templateVersion ? `(v${templateVersion.versionNumber})` : ''}
            </div>
            <div className="dl-muted">Source quote: {invoice.sourceQuoteId ?? 'None'}</div>
          </div>
        </Card>
      </div>

      <div className="dl-page-section">
        <Card title="Line Items" subtitle="Invoice breakdown">
          <DocumentLineItemsTable items={invoice.items} currencyCode={invoice.currencyCode} />
        </Card>
      </div>

      <div className="dl-page-section">
        <Card title="PDF Archive" subtitle="Draft preview and immutable historical versions">
          {pdfRecords.length === 0 ? (
            <p className="dl-muted" style={{ margin: 0 }}>
              No PDFs generated yet for this invoice.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <strong>Latest PDF:</strong>{' '}
                {latestPdf ? `${latestPdf.file.fileName} · v${latestPdf.revision}` : 'None'}
              </div>
              <div>
                <strong>Latest Draft Preview:</strong>{' '}
                {latestDraftPdf
                  ? `${formatDate(latestDraftPdf.generatedAt)} · ${formatBytes(latestDraftPdf.file.sizeBytes)}`
                  : 'Not generated'}
              </div>
              <div>
                <strong>Latest Immutable Archive:</strong>{' '}
                {latestImmutablePdf
                  ? `${formatDate(latestImmutablePdf.generatedAt)} · v${latestImmutablePdf.revision}`
                  : 'Not archived'}
              </div>
              <div className="dl-inline-actions">
                <Button size="sm" variant="secondary" onClick={() => handleOpenPdf(latestPdf?.id)}>
                  Open Latest PDF
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDownloadPdf(latestPdf?.id)}>
                  Download Latest PDF
                </Button>
                <Link to="/pdf-archive">
                  <Button size="sm">Open PDF Archive</Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="dl-page-section">
        <Card title="Email Delivery" subtitle="Send attempts and outcomes for this invoice">
          {recentEmailLogs.length === 0 ? (
            <p className="dl-muted" style={{ margin: 0 }}>
              No email sends recorded yet.
            </p>
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
                  disabled={!canSendEmails || emailCapabilityLoading}
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

        <DocumentStatusTimeline entries={invoice.statusHistory} title="Invoice Timeline" />
      </div>

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
    </>
  );
}
