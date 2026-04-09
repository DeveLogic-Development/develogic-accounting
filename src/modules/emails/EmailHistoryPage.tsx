import { useMemo, useState } from 'react';
import { emailLogs } from '@/mocks/data';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Button } from '@/design-system/primitives/Button';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { EmailStatusBadge } from '@/design-system/patterns/StatusBadge';
import { formatDate } from '@/utils/format';
import { EmptyState } from '@/design-system/patterns/EmptyState';

export function EmailHistoryPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = useMemo(
    () =>
      emailLogs.filter((entry) => {
        const statusMatch = status === 'all' || entry.status === status;
        const searchMatch =
          search.trim().length === 0 ||
          [entry.documentNumber, entry.recipientEmail, entry.subject].some((field) =>
            field.toLowerCase().includes(search.toLowerCase()),
          );

        return statusMatch && searchMatch;
      }),
    [search, status],
  );

  return (
    <>
      <PageHeader
        title="Email History"
        subtitle="Delivery events and send outcomes for customer communications."
        actions={<Button variant="secondary">Resend Selected</Button>}
      />

      <FilterBar>
        <Input
          placeholder="Search by recipient, subject, or doc #"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(320px, 100%)' }}
        />
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { label: 'All statuses', value: 'all' },
            { label: 'Sent', value: 'sent' },
            { label: 'Queued', value: 'queued' },
            { label: 'Failed', value: 'failed' },
            { label: 'Bounced', value: 'bounced' },
          ]}
          style={{ width: 160 }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No email records"
          description="No email log entries match your current filters."
          action={<Button variant="primary">Clear Filters</Button>}
        />
      ) : (
        <ResponsiveList
          headers={['Document', 'Recipient', 'Subject', 'Status', 'Sent At']}
          desktopRows={
            <>
              {filtered.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.documentNumber}</td>
                  <td>{entry.recipientEmail}</td>
                  <td>{entry.subject}</td>
                  <td>
                    <EmailStatusBadge status={entry.status} />
                  </td>
                  <td>{formatDate(entry.sentAt)}</td>
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
                </article>
              ))}
            </>
          }
        />
      )}
    </>
  );
}
