import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clients } from '@/mocks/data';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Button } from '@/design-system/primitives/Button';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { InvoiceStatusBadge } from '@/design-system/patterns/StatusBadge';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { formatDate, formatMinorCurrency } from '@/utils/format';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { matchesDateRange, matchesSearchText } from '@/modules/insights/domain/filters';

export function InvoicesListPage() {
  const navigate = useNavigate();
  const { invoiceSummaries, duplicateInvoice, transitionInvoice } = useAccounting();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [clientId, setClientId] = useState('all');
  const [issueDateFrom, setIssueDateFrom] = useState('');
  const [issueDateTo, setIssueDateTo] = useState('');
  const [dueBefore, setDueBefore] = useState('');
  const [segment, setSegment] = useState<'all' | 'unpaid' | 'overdue'>('all');
  const [sort, setSort] = useState<'due_asc' | 'due_desc' | 'outstanding_desc' | 'issue_desc'>('due_asc');
  const [message, setMessage] = useState<string | null>(null);

  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [],
  );

  const filtered = useMemo(
    () => {
      const rows = invoiceSummaries.filter((invoice) => {
        const statusMatch = status === 'all' || invoice.status === status;
        const clientMatch = clientId === 'all' || invoice.clientId === clientId;
        const issueDateMatch = matchesDateRange(
          invoice.issueDate,
          issueDateFrom || undefined,
          issueDateTo || undefined,
        );
        const dueMatch = dueBefore.length === 0 || invoice.dueDate <= dueBefore;
        const segmentMatch =
          segment === 'all' ||
          (segment === 'overdue' && invoice.status === 'overdue') ||
          (segment === 'unpaid' && invoice.outstandingMinor > 0);
        const clientName = clientNameById.get(invoice.clientId) ?? 'Unknown client';

        const searchMatch = matchesSearchText(search, [invoice.invoiceNumber, clientName, invoice.status]);

        return statusMatch && clientMatch && issueDateMatch && dueMatch && segmentMatch && searchMatch;
      });

      rows.sort((a, b) => {
        if (sort === 'due_desc') return b.dueDate.localeCompare(a.dueDate);
        if (sort === 'outstanding_desc') return b.outstandingMinor - a.outstandingMinor;
        if (sort === 'issue_desc') return b.issueDate.localeCompare(a.issueDate);
        return a.dueDate.localeCompare(b.dueDate);
      });

      return rows;
    },
    [
      clientNameById,
      clientId,
      dueBefore,
      invoiceSummaries,
      issueDateFrom,
      issueDateTo,
      search,
      segment,
      sort,
      status,
    ],
  );

  const overdueCount = invoiceSummaries.filter((invoice) => invoice.status === 'overdue').length;
  const outstandingTotalMinor = invoiceSummaries.reduce(
    (sum, invoice) => sum + invoice.outstandingMinor,
    0,
  );

  const handleDuplicate = (invoiceId: string) => {
    const result = duplicateInvoice(invoiceId);
    if (result.ok && result.data) {
      navigate(`/invoices/${result.data.id}/edit`);
      return;
    }

    setMessage(result.error ?? 'Unable to duplicate invoice.');
  };

  const handleTransition = (invoiceId: string, target: 'approved' | 'sent') => {
    const result = transitionInvoice(invoiceId, target);
    setMessage(result.ok ? `Invoice marked as ${target}.` : result.error ?? 'Action failed.');
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={`Overdue invoices: ${overdueCount} · Outstanding: ${formatMinorCurrency(outstandingTotalMinor)}`}
        actions={
          <Link to="/invoices/new">
            <Button variant="primary">Create Invoice</Button>
          </Link>
        }
      />

      {message ? <div className="dl-validation-inline" style={{ marginBottom: 12 }}>{message}</div> : null}

      <FilterBar>
        <Select
          value={segment}
          onChange={(event) => setSegment(event.target.value as 'all' | 'unpaid' | 'overdue')}
          options={[
            { label: 'All Segments', value: 'all' },
            { label: 'Unpaid', value: 'unpaid' },
            { label: 'Overdue', value: 'overdue' },
          ]}
          style={{ width: 180 }}
        />
        <Input
          placeholder="Search invoice number, client, or status"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(360px, 100%)' }}
        />
        <Select
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          options={[
            { label: 'All clients', value: 'all' },
            ...clients.map((client) => ({ label: client.name, value: client.id })),
          ]}
          style={{ width: 220 }}
        />
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { label: 'All statuses', value: 'all' },
            { label: 'Draft', value: 'draft' },
            { label: 'Approved', value: 'approved' },
            { label: 'Sent', value: 'sent' },
            { label: 'Partially Paid', value: 'partially_paid' },
            { label: 'Paid', value: 'paid' },
            { label: 'Overdue', value: 'overdue' },
            { label: 'Void', value: 'void' },
          ]}
          style={{ width: 190 }}
        />
        <Input
          type="date"
          value={issueDateFrom}
          onChange={(event) => setIssueDateFrom(event.target.value)}
          style={{ width: 170 }}
        />
        <Input
          type="date"
          value={issueDateTo}
          onChange={(event) => setIssueDateTo(event.target.value)}
          style={{ width: 170 }}
        />
        <Input
          type="date"
          value={dueBefore}
          onChange={(event) => setDueBefore(event.target.value)}
          style={{ width: 180 }}
        />
        <Select
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as 'due_asc' | 'due_desc' | 'outstanding_desc' | 'issue_desc')
          }
          options={[
            { label: 'Sort: Due Date (Oldest)', value: 'due_asc' },
            { label: 'Sort: Due Date (Newest)', value: 'due_desc' },
            { label: 'Sort: Outstanding (High)', value: 'outstanding_desc' },
            { label: 'Sort: Issue Date (Newest)', value: 'issue_desc' },
          ]}
          style={{ width: 240 }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description="Try changing filters or create a new invoice."
          action={
            <Link to="/invoices/new">
              <Button variant="primary">Create Invoice</Button>
            </Link>
          }
        />
      ) : (
        <>
          <ResponsiveList
            headers={[
              'Invoice #',
              'Client',
              'Status',
              'Issue Date',
              'Due Date',
              'Total',
              'Paid',
              'Outstanding',
              'Actions',
            ]}
            desktopRows={
              <>
                {filtered.map((invoice) => {
                  const clientName = clientNameById.get(invoice.clientId) ?? 'Unknown client';

                  return (
                    <tr key={invoice.id}>
                      <td>
                        <strong>{invoice.invoiceNumber}</strong>
                      </td>
                      <td>{clientName}</td>
                      <td>
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td>{formatDate(invoice.issueDate)}</td>
                      <td>{formatDate(invoice.dueDate)}</td>
                      <td>{formatMinorCurrency(invoice.totalMinor)}</td>
                      <td>{formatMinorCurrency(invoice.paidMinor)}</td>
                      <td>{formatMinorCurrency(invoice.outstandingMinor)}</td>
                      <td>
                        <div className="dl-inline-actions">
                          <Link to={`/invoices/${invoice.id}`}>View</Link>
                          {invoice.status === 'draft' ? (
                            <Button size="sm" type="button" onClick={() => handleTransition(invoice.id, 'approved')}>
                              Approve
                            </Button>
                          ) : null}
                          {invoice.status === 'approved' ? (
                            <Button size="sm" type="button" onClick={() => handleTransition(invoice.id, 'sent')}>
                              Mark Sent
                            </Button>
                          ) : null}
                          <Button size="sm" type="button" onClick={() => handleDuplicate(invoice.id)}>
                            Duplicate
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </>
            }
            mobileCards={
              <>
                {filtered.map((invoice) => {
                  const clientName = clientNameById.get(invoice.clientId) ?? 'Unknown client';
                  return (
                    <article key={invoice.id} className="dl-mobile-item">
                      <div className="dl-mobile-item-header">
                        <div>
                          <strong>{invoice.invoiceNumber}</strong>
                          <div className="dl-muted" style={{ fontSize: 12 }}>
                            {clientName}
                          </div>
                        </div>
                        <InvoiceStatusBadge status={invoice.status} />
                      </div>
                      <div className="dl-mobile-meta">
                        <div>
                          <span>Outstanding</span>
                          <div>{formatMinorCurrency(invoice.outstandingMinor)}</div>
                        </div>
                        <div>
                          <span>Due Date</span>
                          <div>{formatDate(invoice.dueDate)}</div>
                        </div>
                      </div>
                      <div className="dl-inline-actions" style={{ marginTop: 12 }}>
                        <Link to={`/invoices/${invoice.id}`}>Open</Link>
                        {invoice.status === 'draft' ? (
                          <Button size="sm" type="button" onClick={() => handleTransition(invoice.id, 'approved')}>
                            Approve
                          </Button>
                        ) : null}
                        {invoice.status === 'approved' ? (
                          <Button size="sm" type="button" onClick={() => handleTransition(invoice.id, 'sent')}>
                            Mark Sent
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </>
            }
          />
          <div className="dl-muted" style={{ marginTop: 10, fontSize: 12 }}>
            Showing {filtered.length} invoices · Page 1 of 1
          </div>
        </>
      )}
    </>
  );
}
