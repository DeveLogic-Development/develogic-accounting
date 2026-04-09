import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Button } from '@/design-system/primitives/Button';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { EmailStatusBadge } from '@/design-system/patterns/StatusBadge';
import { formatDate } from '@/utils/format';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { useEmails } from '@/modules/emails/hooks/useEmails';
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';
import { EmailComposeModal } from '@/modules/emails/components/EmailComposeModal';
import { EmailComposeDraft, EmailLogListRow } from '@/modules/emails/domain/types';
import { matchesDateRange, matchesSearchText } from '@/modules/insights/domain/filters';

function documentPath(row: EmailLogListRow): string {
  if (row.documentType === 'quote') return `/quotes/${row.documentId}`;
  return `/invoices/${row.documentId}`;
}

export function EmailHistoryPage() {
  const { rows, createComposeDraftForResend, sendEmailDraft } = useEmails();
  const { getPdfRecordsForDocument } = usePdfArchive();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<'attempted_desc' | 'attempted_asc'>('attempted_desc');
  const [composeDraft, setComposeDraft] = useState<EmailComposeDraft | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMessage, setComposeMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const filtered = useMemo(
    () => {
      const filteredRows = rows.filter((entry) => {
        const statusMatch = status === 'all' || entry.status === status;
        const typeMatch = type === 'all' || entry.documentType === type;
        const dateMatch = matchesDateRange(entry.attemptedAt, dateFrom || undefined, dateTo || undefined);
        const searchMatch = matchesSearchText(search, [
          entry.documentNumber,
          entry.recipientEmail,
          entry.subject,
          entry.status,
        ]);

        return statusMatch && typeMatch && dateMatch && searchMatch;
      });

      filteredRows.sort((a, b) => {
        if (sort === 'attempted_asc') return a.attemptedAt.localeCompare(b.attemptedAt);
        return b.attemptedAt.localeCompare(a.attemptedAt);
      });

      return filteredRows;
    },
    [dateFrom, dateTo, rows, search, sort, status, type],
  );

  const attachmentOptions = useMemo(() => {
    if (!composeDraft) return [];

    return getPdfRecordsForDocument({
      documentType: composeDraft.document.documentType,
      documentId: composeDraft.document.documentId,
    }).map((record) => ({
      value: record.id,
      label: `v${record.revision} · ${record.file.fileName} ${record.immutable ? '(Immutable)' : '(Draft)'}`,
    }));
  }, [composeDraft, getPdfRecordsForDocument]);

  const openResend = (logId: string) => {
    const result = createComposeDraftForResend(logId);
    if (!result.ok || !result.data) {
      setComposeMessage(result.error ?? 'Unable to prepare resend draft.');
      return;
    }

    setComposeDraft(result.data);
    setComposeMessage(null);
    setComposeOpen(true);
  };

  const handleSend = async () => {
    if (!composeDraft) return;
    setSending(true);
    const result = await sendEmailDraft(composeDraft);
    setSending(false);

    if (result.ok) {
      setComposeMessage(result.warning ?? 'Email sent successfully.');
      setComposeOpen(false);
      setComposeDraft(null);
      return;
    }

    setComposeMessage(result.error ?? 'Unable to send email.');
  };

  return (
    <>
      <PageHeader
        title="Email History"
        subtitle="Delivery outcomes for quote and invoice emails with archived attachment traceability."
        actions={
          filtered.length > 0 ? (
            <Button variant="secondary" onClick={() => openResend(filtered[0].id)}>
              Resend Latest
            </Button>
          ) : undefined
        }
      />

      {composeMessage ? <div className="dl-validation-inline" style={{ marginBottom: 12 }}>{composeMessage}</div> : null}

      <FilterBar>
        <Input
          placeholder="Search by recipient, subject, or document #"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(320px, 100%)' }}
        />
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { label: 'All statuses', value: 'all' },
            { label: 'Queued', value: 'queued' },
            { label: 'Sending', value: 'sending' },
            { label: 'Sent', value: 'sent' },
            { label: 'Failed', value: 'failed' },
            { label: 'Cancelled', value: 'cancelled' },
          ]}
          style={{ width: 180 }}
        />
        <Select
          value={sort}
          onChange={(event) => setSort(event.target.value as 'attempted_desc' | 'attempted_asc')}
          options={[
            { label: 'Sort: Newest Attempt', value: 'attempted_desc' },
            { label: 'Sort: Oldest Attempt', value: 'attempted_asc' },
          ]}
          style={{ width: 220 }}
        />
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          style={{ width: 170 }}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          style={{ width: 170 }}
        />
        <Select
          value={type}
          onChange={(event) => setType(event.target.value)}
          options={[
            { label: 'All document types', value: 'all' },
            { label: 'Quotes', value: 'quote' },
            { label: 'Invoices', value: 'invoice' },
          ]}
          style={{ width: 180 }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No email records"
          description="No email log entries match your current filters."
          action={
            <Button
              variant="primary"
              onClick={() => {
                setSearch('');
                setStatus('all');
                setType('all');
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        <ResponsiveList
          headers={['Type', 'Document', 'Recipient', 'Subject', 'Status', 'Attempted', 'Actions']}
          desktopRows={
            <>
              {filtered.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.documentType === 'quote' ? 'Quote' : 'Invoice'}</td>
                  <td>{entry.documentNumber}</td>
                  <td>{entry.recipientEmail}</td>
                  <td>{entry.subject}</td>
                  <td>
                    <EmailStatusBadge status={entry.status} />
                  </td>
                  <td>{formatDate(entry.sentAt ?? entry.attemptedAt)}</td>
                  <td>
                    <div className="dl-inline-actions">
                      <Link to={documentPath(entry)}>
                        <Button size="sm" variant="secondary">
                          Open Doc
                        </Button>
                      </Link>
                      <Button size="sm" onClick={() => openResend(entry.id)}>
                        Resend
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </>
          }
          mobileCards={
            <>
              {filtered.map((entry) => (
                <article key={entry.id} className="dl-mobile-item">
                  <div className="dl-mobile-item-header">
                    <strong>{entry.documentNumber}</strong>
                    <EmailStatusBadge status={entry.status} />
                  </div>
                  <div className="dl-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                    {entry.recipientEmail}
                  </div>
                  <div style={{ fontSize: 13 }}>{entry.subject}</div>
                  <div className="dl-inline-actions" style={{ marginTop: 10 }}>
                    <Link to={documentPath(entry)}>
                      <Button size="sm" variant="secondary">
                        Open Doc
                      </Button>
                    </Link>
                    <Button size="sm" onClick={() => openResend(entry.id)}>
                      Resend
                    </Button>
                  </div>
                </article>
              ))}
            </>
          }
        />
      )}

      <EmailComposeModal
        open={composeOpen}
        title="Resend Document Email"
        draft={composeDraft}
        attachmentOptions={attachmentOptions}
        sending={sending}
        message={composeMessage}
        onClose={() => {
          setComposeOpen(false);
          setComposeDraft(null);
        }}
        onChange={(draft) => setComposeDraft(draft)}
        onSend={handleSend}
      />
    </>
  );
}
