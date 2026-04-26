import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Card } from '@/design-system/primitives/Card';
import { Button } from '@/design-system/primitives/Button';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { Select } from '@/design-system/primitives/Select';
import { Input } from '@/design-system/primitives/Input';
import { Textarea } from '@/design-system/primitives/Textarea';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { formatDate, formatMinorCurrency } from '@/utils/format';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { InvoicePaymentSubmissionStatus } from '@/modules/accounting/domain/types';
import { matchesSearchText } from '@/modules/insights/domain/filters';
import { toSanitizedDecimalNumber } from '@/utils/numeric-input';

type ReviewAction = 'under_review' | 'approved' | 'rejected';

function isHttpLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^blob:/i.test(value);
}

function toDataUrlFromRawProof(input: { dataUrl?: string; mimeType?: string }): string | null {
  const raw = (input.dataUrl ?? '').trim();
  if (!raw) return null;

  if (raw.startsWith('data:')) {
    return raw;
  }

  if (isHttpLikeUrl(raw)) {
    return raw;
  }

  const normalized = raw.replace(/\s+/g, '');
  if (!normalized) return null;
  const payload = normalized.startsWith('base64,') ? normalized.slice('base64,'.length) : normalized;
  const mimeType = (input.mimeType ?? '').trim().toLowerCase() || 'application/octet-stream';
  return `data:${mimeType};base64,${payload}`;
}

function dataUrlToObjectUrl(dataUrl: string): string | null {
  const dataUrlMatch = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
  if (!dataUrlMatch) return null;

  const mimeType = dataUrlMatch[1] || 'application/octet-stream';
  const encodedPayload = dataUrlMatch[3] || '';
  try {
    const bytes = dataUrlMatch[2]
      ? Uint8Array.from(atob(encodedPayload), (char) => char.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(encodedPayload));
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function statusLabel(status: InvoicePaymentSubmissionStatus): string {
  if (status === 'submitted') return 'Submitted';
  if (status === 'under_review') return 'Under Review';
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Cancelled';
}

function statusTone(status: InvoicePaymentSubmissionStatus): 'info' | 'warning' | 'success' | 'danger' | 'neutral' {
  if (status === 'submitted') return 'info';
  if (status === 'under_review') return 'warning';
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'neutral';
}

export function InvoicePaymentSubmissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceFilter = searchParams.get('invoiceId') ?? '';
  const accounting = useAccounting();
  const { getClientNameById } = useMasterData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoicePaymentSubmissionStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [approvedPaymentDate, setApprovedPaymentDate] = useState('');
  const [approvedPaymentReference, setApprovedPaymentReference] = useState('');

  const filtered = useMemo(() => {
    const submissions = accounting.getAllInvoicePaymentSubmissions();
    return submissions.filter((submission) => {
      if (invoiceFilter && submission.invoiceId !== invoiceFilter) return false;
      if (statusFilter !== 'all' && submission.status !== statusFilter) return false;
      const invoice = accounting.getInvoiceById(submission.invoiceId);
      const clientName = getClientNameById(submission.clientId);
      return matchesSearchText(search, [
        submission.id,
        submission.submittedReference ?? '',
        submission.payerName ?? '',
        submission.payerEmail ?? '',
        invoice?.invoiceNumber ?? '',
        clientName,
      ]);
    });
  }, [accounting, getClientNameById, invoiceFilter, search, statusFilter]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(filtered[0].id);
      return;
    }
    if (selectedId && !filtered.some((entry) => entry.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const selected = selectedId ? filtered.find((entry) => entry.id === selectedId) : undefined;
  const selectedInvoice = selected ? accounting.getInvoiceById(selected.invoiceId) : undefined;
  const selectedSummary = selectedInvoice ? accounting.getInvoicePaymentSummary(selectedInvoice.id) : undefined;

  useEffect(() => {
    if (!selected) return;
    setReviewNotes(selected.reviewNotes ?? '');
    setApprovedAmount(selected.submittedAmountMinor / 100);
    setApprovedPaymentDate(selected.submittedPaymentDate);
    setApprovedPaymentReference(selected.submittedReference ?? selectedInvoice?.eftPaymentReference ?? '');
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const runReviewAction = (action: ReviewAction) => {
    if (!selected) return;
    const result = accounting.reviewInvoicePaymentSubmission(selected.id, {
      status: action,
      reviewNotes,
      approvedAmount: action === 'approved' ? approvedAmount : undefined,
      approvedPaymentDate: action === 'approved' ? approvedPaymentDate : undefined,
      approvedPaymentReference: action === 'approved' ? approvedPaymentReference : undefined,
    });
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok
        ? action === 'approved'
          ? 'Submission approved and payment recorded.'
          : action === 'rejected'
            ? 'Submission rejected with review notes.'
            : 'Submission moved to under review.'
        : result.error ?? 'Unable to update submission.',
    });
  };

  const openProof = () => {
    if (!selected?.proofFile) {
      setNotice({ tone: 'warning', text: 'Proof file metadata is missing for this submission.' });
      return;
    }

    const previewSource = toDataUrlFromRawProof({
      dataUrl: selected.proofFile.dataUrl,
      mimeType: selected.proofFile.mimeType,
    });

    if (!previewSource) {
      setNotice({
        tone: 'warning',
        text: selected.proofFile.storageKey
          ? 'Proof file is stored by key only. Add your storage-file retrieval endpoint to enable preview.'
          : 'Proof file content is unavailable for this submission.',
      });
      return;
    }

    const popup = window.open('', '_blank');
    if (!popup) {
      setNotice({ tone: 'warning', text: 'Popup blocked by browser. Please allow popups for this site and retry.' });
      return;
    }

    if (isHttpLikeUrl(previewSource)) {
      popup.location.replace(previewSource);
      return;
    }

    const objectUrl = dataUrlToObjectUrl(previewSource);
    if (!objectUrl) {
      popup.close();
      setNotice({ tone: 'error', text: 'Proof file content is invalid and could not be previewed.' });
      return;
    }

    popup.location.replace(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  return (
    <div className="dl-page-stack">
      <PageHeader
        title="Payment Submissions"
        subtitle="Review submitted EFT proofs and confirm payments."
        actions={
          <div className="dl-inline-actions">
            {invoiceFilter ? (
              <Button
                variant="secondary"
                onClick={() => setSearchParams({})}
              >
                Clear Invoice Filter
              </Button>
            ) : null}
            <Link to="/invoices">
              <Button variant="ghost">Back to Invoices</Button>
            </Link>
          </div>
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <section className="dl-filter-bar" aria-label="Payment submission filters">
        <Input
          aria-label="Search payment submissions"
          placeholder="Search invoice number, payer, reference"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(360px, 100%)' }}
        />
        <Select
          aria-label="Submission status filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | InvoicePaymentSubmissionStatus)}
          options={[
            { label: 'All statuses', value: 'all' },
            { label: 'Submitted', value: 'submitted' },
            { label: 'Under Review', value: 'under_review' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
            { label: 'Cancelled', value: 'cancelled' },
          ]}
          style={{ width: 180 }}
        />
      </section>

      {filtered.length === 0 ? (
        <EmptyState
          title="No payment submissions"
          description="Submitted EFT proofs will appear here for finance review."
        />
      ) : (
        <div className="dl-grid cols-2">
          <Card title="Submission Queue" subtitle={`${filtered.length} submission(s)`}>
            <ResponsiveList
              headers={['Invoice', 'Customer', 'Amount', 'Submitted', 'Status', 'Actions']}
              desktopRows={
                <>
                  {filtered.map((entry) => {
                    const invoice = accounting.getInvoiceById(entry.invoiceId);
                    const clientName = getClientNameById(entry.clientId);
                    return (
                      <tr key={entry.id}>
                        <td>{invoice?.invoiceNumber ?? entry.invoiceId}</td>
                        <td>{clientName}</td>
                        <td>{formatMinorCurrency(entry.submittedAmountMinor, invoice?.currencyCode ?? 'ZAR')}</td>
                        <td>{formatDate(entry.createdAt)}</td>
                        <td>
                          <span className={`dl-badge ${statusTone(entry.status)}`}>{statusLabel(entry.status)}</span>
                        </td>
                        <td>
                          <Button size="sm" variant={selectedId === entry.id ? 'primary' : 'secondary'} onClick={() => setSelectedId(entry.id)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </>
              }
              mobileCards={
                <>
                  {filtered.map((entry) => {
                    const invoice = accounting.getInvoiceById(entry.invoiceId);
                    const clientName = getClientNameById(entry.clientId);
                    return (
                      <article key={entry.id} className="dl-mobile-item">
                        <div className="dl-mobile-item-header">
                          <strong>{invoice?.invoiceNumber ?? entry.invoiceId}</strong>
                          <span className={`dl-badge ${statusTone(entry.status)}`}>{statusLabel(entry.status)}</span>
                        </div>
                        <div className="dl-muted">{clientName}</div>
                        <div className="dl-muted" style={{ marginTop: 4 }}>
                          {formatMinorCurrency(entry.submittedAmountMinor, invoice?.currencyCode ?? 'ZAR')} · {formatDate(entry.createdAt)}
                        </div>
                        <div className="dl-inline-actions" style={{ marginTop: 10 }}>
                          <Button size="sm" variant={selectedId === entry.id ? 'primary' : 'secondary'} onClick={() => setSelectedId(entry.id)}>
                            Review
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </>
              }
            />
          </Card>

          <Card
            title={selected ? `Review ${selectedInvoice?.invoiceNumber ?? 'Submission'}` : 'Review Submission'}
            subtitle={selected ? `Submitted ${formatDate(selected.createdAt)}` : 'Select a submission from the queue'}
          >
            {!selected || !selectedInvoice ? (
              <p className="dl-muted" style={{ margin: 0 }}>
                Choose a submission to inspect proof details and complete review actions.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="dl-meta-grid">
                  <div><strong>Customer:</strong> {getClientNameById(selected.clientId)}</div>
                  <div><strong>Current Invoice Status:</strong> {selectedInvoice.status}</div>
                  <div><strong>Submitted Amount:</strong> {formatMinorCurrency(selected.submittedAmountMinor, selectedInvoice.currencyCode)}</div>
                  <div><strong>Outstanding:</strong> {formatMinorCurrency(selectedSummary?.outstandingMinor ?? 0, selectedInvoice.currencyCode)}</div>
                  <div><strong>Submitted Date:</strong> {formatDate(selected.submittedPaymentDate)}</div>
                  <div><strong>Reference:</strong> {selected.submittedReference || selectedInvoice.eftPaymentReference || '—'}</div>
                  <div><strong>Payer:</strong> {selected.payerName || '—'}</div>
                  <div><strong>Payer Email:</strong> {selected.payerEmail || '—'}</div>
                </div>

                {selected.note ? (
                  <InlineNotice tone="info">{selected.note}</InlineNotice>
                ) : null}

                <div className="dl-inline-actions">
                  <Button size="sm" variant="secondary" onClick={openProof}>
                    Open Proof File
                  </Button>
                  <Link to={`/invoices/${selected.invoiceId}`}>
                    <Button size="sm" variant="ghost">
                      Open Invoice
                    </Button>
                  </Link>
                </div>

                <Textarea
                  label="Review Notes"
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder="Add reviewer comments, especially for rejections."
                />

                <Input
                  label="Approved Amount"
                  type="text"
                  inputMode="decimal"
                  value={approvedAmount}
                  onChange={(event) => setApprovedAmount(toSanitizedDecimalNumber(event.target.value))}
                />
                <div className="dl-grid cols-2">
                  <Input
                    label="Approved Payment Date"
                    type="date"
                    value={approvedPaymentDate}
                    onChange={(event) => setApprovedPaymentDate(event.target.value)}
                  />
                  <Input
                    label="Approved Reference"
                    value={approvedPaymentReference}
                    onChange={(event) => setApprovedPaymentReference(event.target.value)}
                  />
                </div>

                <div className="dl-inline-actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => runReviewAction('under_review')}
                    disabled={selected.status === 'approved' || selected.status === 'cancelled'}
                  >
                    Mark Under Review
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => runReviewAction('approved')}
                    disabled={selected.status === 'approved' || selected.status === 'cancelled'}
                  >
                    Approve and Record Payment
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => runReviewAction('rejected')}
                    disabled={selected.status === 'approved' || selected.status === 'cancelled'}
                  >
                    Reject Submission
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
