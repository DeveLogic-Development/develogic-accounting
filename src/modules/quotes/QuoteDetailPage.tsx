import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { clients } from '@/mocks/data';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { QuoteStatusBadge } from '@/design-system/patterns/StatusBadge';
import { formatBytes, formatDate, formatMinorCurrency } from '@/utils/format';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { useTemplates } from '@/modules/templates/hooks/useTemplates';
import { calculateDocumentTotals } from '@/modules/accounting/domain/calculations';
import {
  canEditQuote,
  getAllowedQuoteTransitions,
} from '@/modules/accounting/domain/quote-rules';
import { DocumentLineItemsTable } from '@/modules/accounting/components/DocumentLineItemsTable';
import { DocumentStatusTimeline } from '@/modules/accounting/components/DocumentStatusTimeline';
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';

const QUICK_ACTION_TRANSITIONS: Array<{
  status: 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  label: string;
}> = [
  { status: 'sent', label: 'Mark Sent' },
  { status: 'viewed', label: 'Mark Viewed' },
  { status: 'accepted', label: 'Accept' },
  { status: 'rejected', label: 'Reject' },
  { status: 'expired', label: 'Expire' },
];

export function QuoteDetailPage() {
  const navigate = useNavigate();
  const { quoteId } = useParams();
  const { getQuoteById, transitionQuote, convertQuoteToInvoice, duplicateQuote } = useAccounting();
  const { getTemplateById, getTemplateVersionById } = useTemplates();
  const {
    generateQuotePdf,
    getPdfRecordsForDocument,
    openPdfRecord,
    downloadPdfRecord,
  } = usePdfArchive();
  const [message, setMessage] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const quote = quoteId ? getQuoteById(quoteId) : undefined;

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

  const totals = calculateDocumentTotals(quote.items, quote.documentDiscountPercent);
  const client = clients.find((entry) => entry.id === quote.clientId);
  const template = getTemplateById(quote.templateId ?? '');
  const templateVersion = getTemplateVersionById(quote.templateVersionId);
  const editable = canEditQuote(quote.status).allowed;
  const transitions = getAllowedQuoteTransitions(quote.status);
  const pdfRecords = getPdfRecordsForDocument({ documentType: 'quote', documentId: quote.id });
  const latestPdf = pdfRecords[0];
  const latestImmutablePdf = pdfRecords.find((record) => record.immutable);
  const latestDraftPdf = pdfRecords.find((record) => !record.immutable);

  const availableTransitionButtons = useMemo(
    () => QUICK_ACTION_TRANSITIONS.filter((entry) => transitions.includes(entry.status)),
    [transitions],
  );

  const handleTransition = (target: 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired') => {
    const note = target === 'rejected' ? window.prompt('Optional rejection note') ?? undefined : undefined;
    const result = transitionQuote(quote.id, target, note);
    setMessage(result.ok ? `Quote marked as ${target}.` : result.error ?? 'Action failed.');
  };

  const handleConvert = () => {
    const result = convertQuoteToInvoice(quote.id);
    if (result.ok && result.data) {
      navigate(`/invoices/${result.data.id}`);
      return;
    }

    setMessage(result.error ?? 'Unable to convert quote.');
  };

  const handleDuplicate = () => {
    const result = duplicateQuote(quote.id);
    if (result.ok && result.data) {
      navigate(`/quotes/${result.data.id}/edit`);
      return;
    }

    setMessage(result.error ?? 'Unable to duplicate quote.');
  };

  const handleGenerateDraftPdf = async () => {
    setIsGeneratingPdf(true);
    const result = await generateQuotePdf(quote.id, {
      generationMode: 'draft_preview',
      source: 'quote_detail',
    });
    setIsGeneratingPdf(false);

    if (result.ok && result.data) {
      setMessage(`Draft PDF generated: ${result.data.file.fileName}`);
      return;
    }

    setMessage(result.error ?? 'Unable to generate draft PDF.');
  };

  const handleArchivePdf = async () => {
    setIsGeneratingPdf(true);
    const result = await generateQuotePdf(quote.id, {
      generationMode: 'historical_archive',
      source: 'quote_detail',
    });
    setIsGeneratingPdf(false);

    if (result.ok && result.data) {
      setMessage(`Archived PDF created: ${result.data.file.fileName}`);
      return;
    }

    setMessage(result.error ?? 'Unable to archive PDF.');
  };

  const handleOpenPdf = (recordId?: string) => {
    if (!recordId) {
      setMessage('No PDF record is available yet.');
      return;
    }

    const result = openPdfRecord(recordId);
    if (!result.ok) {
      setMessage(result.error ?? 'Unable to open PDF.');
    }
  };

  const handleDownloadPdf = (recordId?: string) => {
    if (!recordId) {
      setMessage('No PDF record is available yet.');
      return;
    }

    const result = downloadPdfRecord(recordId);
    setMessage(result.ok ? 'PDF download started.' : result.error ?? 'Unable to download PDF.');
  };

  return (
    <>
      <PageHeader
        title={quote.quoteNumber}
        subtitle={`${client?.name ?? 'Unknown client'} · Issued ${formatDate(quote.issueDate)}`}
        actions={
          <>
            {editable ? (
              <Link to={`/quotes/${quote.id}/edit`}>
                <Button variant="secondary">Edit Quote</Button>
              </Link>
            ) : null}
            <Button type="button" onClick={handleDuplicate}>
              Duplicate
            </Button>
            {quote.status === 'draft' ? (
              <Button type="button" variant="secondary" onClick={handleGenerateDraftPdf} disabled={isGeneratingPdf}>
                {isGeneratingPdf ? 'Generating PDF...' : 'Generate Draft PDF'}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={handleArchivePdf} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? 'Generating PDF...' : 'Archive PDF Snapshot'}
            </Button>
            {quote.status === 'accepted' ? (
              <Button type="button" variant="primary" onClick={handleConvert}>
                Convert to Invoice
              </Button>
            ) : null}
          </>
        }
      />

      {message ? <div className="dl-validation-inline" style={{ marginBottom: 12 }}>{message}</div> : null}

      <div className="dl-grid cols-3">
        <Card title="Status">
          <QuoteStatusBadge status={quote.status} />
          {availableTransitionButtons.length > 0 ? (
            <div className="dl-status-actions" style={{ marginTop: 12 }}>
              {availableTransitionButtons.map((entry) => (
                <Button key={entry.status} size="sm" type="button" onClick={() => handleTransition(entry.status)}>
                  {entry.label}
                </Button>
              ))}
            </div>
          ) : null}
        </Card>
        <Card title="Total">
          <p className="dl-stat-value">{formatMinorCurrency(totals.totalMinor, quote.currencyCode)}</p>
          <p className="dl-stat-meta">Includes tax and discounts</p>
        </Card>
        <Card title="Valid Until">
          <p className="dl-stat-value" style={{ fontSize: 22 }}>
            {formatDate(quote.expiryDate)}
          </p>
          <p className="dl-stat-meta">Quote expires after this date</p>
        </Card>
      </div>

      <div className="dl-grid cols-2" style={{ marginTop: 16 }}>
        <Card title="Client Details" subtitle="Primary billing contact">
          <div style={{ display: 'grid', gap: 8 }}>
            <div>{client?.contactName ?? 'N/A'}</div>
            <div className="dl-muted">{client?.email ?? 'N/A'}</div>
            <div className="dl-muted">{client?.phone ?? 'N/A'}</div>
          </div>
        </Card>

        <Card title="Document Metadata">
          <div style={{ display: 'grid', gap: 8 }}>
            <div>Template: {quote.templateName ?? template?.name ?? 'Not assigned'}</div>
            <div>
              Template Version:{' '}
              {templateVersion ? `v${templateVersion.versionNumber}` : 'Not assigned'}
            </div>
            <div>Payment Terms: {quote.paymentTerms || 'None'}</div>
            <div className="dl-muted">Internal memo: {quote.internalMemo || 'None'}</div>
            {quote.convertedInvoiceId ? (
              <Link to={`/invoices/${quote.convertedInvoiceId}`}>Open converted invoice</Link>
            ) : null}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title="Line Items" subtitle="Quote breakdown">
          <DocumentLineItemsTable items={quote.items} currencyCode={quote.currencyCode} />
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title="PDF Archive" subtitle="Draft preview and immutable historical versions">
          {pdfRecords.length === 0 ? (
            <p className="dl-muted" style={{ margin: 0 }}>
              No PDFs generated yet for this quote.
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

      <div style={{ marginTop: 16 }}>
        <DocumentStatusTimeline entries={quote.statusHistory} title="Quote Timeline" />
      </div>
    </>
  );
}
