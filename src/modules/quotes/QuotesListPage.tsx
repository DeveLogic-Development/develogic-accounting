import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clients } from '@/mocks/data';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Button } from '@/design-system/primitives/Button';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { QuoteStatusBadge } from '@/design-system/patterns/StatusBadge';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { formatDate, formatMinorCurrency } from '@/utils/format';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { matchesDateRange, matchesSearchText } from '@/modules/insights/domain/filters';

export function QuotesListPage() {
  const navigate = useNavigate();
  const { quoteSummaries, transitionQuote, duplicateQuote, convertQuoteToInvoice } = useAccounting();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [clientId, setClientId] = useState('all');
  const [issueDateFrom, setIssueDateFrom] = useState('');
  const [issueDateTo, setIssueDateTo] = useState('');
  const [sort, setSort] = useState<'issue_desc' | 'issue_asc' | 'total_desc' | 'total_asc'>('issue_desc');
  const [segment, setSegment] = useState<'all' | 'needs_action' | 'accepted_not_converted'>('all');
  const [message, setMessage] = useState<string | null>(null);

  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [],
  );

  const filtered = useMemo(
    () => {
      const rows = quoteSummaries.filter((quote) => {
        const statusMatch = status === 'all' || quote.status === status;
        const clientMatch = clientId === 'all' || quote.clientId === clientId;
        const issueDateMatch = matchesDateRange(quote.issueDate, issueDateFrom || undefined, issueDateTo || undefined);
        const segmentMatch =
          segment === 'all' ||
          (segment === 'accepted_not_converted' && quote.status === 'accepted') ||
          (segment === 'needs_action' && ['draft', 'sent', 'viewed', 'accepted'].includes(quote.status));

        const clientName = clientNameById.get(quote.clientId) ?? 'Unknown client';
        const searchMatch = matchesSearchText(search, [quote.quoteNumber, clientName, quote.status]);

        return statusMatch && clientMatch && issueDateMatch && segmentMatch && searchMatch;
      });

      rows.sort((a, b) => {
        if (sort === 'issue_asc') return a.issueDate.localeCompare(b.issueDate);
        if (sort === 'total_desc') return b.totalMinor - a.totalMinor;
        if (sort === 'total_asc') return a.totalMinor - b.totalMinor;
        return b.issueDate.localeCompare(a.issueDate);
      });
      return rows;
    },
    [clientNameById, clientId, issueDateFrom, issueDateTo, quoteSummaries, search, segment, sort, status],
  );

  const acceptedAwaitingConversion = quoteSummaries.filter((quote) => quote.status === 'accepted').length;

  const handleTransition = (quoteId: string, target: 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired') => {
    const result = transitionQuote(quoteId, target);
    setMessage(result.ok ? `Quote marked as ${target.replace('_', ' ')}.` : result.error ?? 'Action failed.');
  };

  const handleDuplicate = (quoteId: string) => {
    const result = duplicateQuote(quoteId);
    if (result.ok && result.data) {
      navigate(`/quotes/${result.data.id}/edit`);
      return;
    }
    setMessage(result.error ?? 'Unable to duplicate quote.');
  };

  const handleConvert = (quoteId: string) => {
    const result = convertQuoteToInvoice(quoteId);
    if (result.ok && result.data) {
      navigate(`/invoices/${result.data.id}`);
      return;
    }
    setMessage(result.error ?? 'Unable to convert quote.');
  };

  return (
    <>
      <PageHeader
        title="Quotes"
        subtitle={`Accepted awaiting conversion: ${acceptedAwaitingConversion}`}
        actions={
          <Link to="/quotes/new">
            <Button variant="primary">Create Quote</Button>
          </Link>
        }
      />

      {message ? <div className="dl-validation-inline" style={{ marginBottom: 12 }}>{message}</div> : null}

      <FilterBar>
        <Select
          value={segment}
          onChange={(event) =>
            setSegment(event.target.value as 'all' | 'needs_action' | 'accepted_not_converted')
          }
          options={[
            { label: 'All Segments', value: 'all' },
            { label: 'Needs Action', value: 'needs_action' },
            { label: 'Accepted Awaiting Conversion', value: 'accepted_not_converted' },
          ]}
          style={{ width: 250 }}
        />
        <Input
          placeholder="Search quote number, client, or status"
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
            { label: 'Sent', value: 'sent' },
            { label: 'Viewed', value: 'viewed' },
            { label: 'Accepted', value: 'accepted' },
            { label: 'Rejected', value: 'rejected' },
            { label: 'Expired', value: 'expired' },
            { label: 'Converted', value: 'converted' },
          ]}
          style={{ width: 180 }}
        />
        <Input
          type="date"
          value={issueDateFrom}
          onChange={(event) => setIssueDateFrom(event.target.value)}
          style={{ width: 180 }}
        />
        <Input
          type="date"
          value={issueDateTo}
          onChange={(event) => setIssueDateTo(event.target.value)}
          style={{ width: 180 }}
        />
        <Select
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as 'issue_desc' | 'issue_asc' | 'total_desc' | 'total_asc')
          }
          options={[
            { label: 'Sort: Issue Date (Newest)', value: 'issue_desc' },
            { label: 'Sort: Issue Date (Oldest)', value: 'issue_asc' },
            { label: 'Sort: Total (High to Low)', value: 'total_desc' },
            { label: 'Sort: Total (Low to High)', value: 'total_asc' },
          ]}
          style={{ width: 240 }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No quotes found"
          description="Try changing filters or create a new quote."
          action={
            <Link to="/quotes/new">
              <Button variant="primary">Create Quote</Button>
            </Link>
          }
        />
      ) : (
        <>
          <ResponsiveList
            headers={['Quote #', 'Client', 'Status', 'Issue Date', 'Expiry Date', 'Total', 'Actions']}
            desktopRows={
              <>
                {filtered.map((quote) => {
                  const clientName = clientNameById.get(quote.clientId) ?? 'Unknown client';

                  return (
                    <tr key={quote.id}>
                      <td>
                        <strong>{quote.quoteNumber}</strong>
                      </td>
                      <td>{clientName}</td>
                      <td>
                        <QuoteStatusBadge status={quote.status} />
                      </td>
                      <td>{formatDate(quote.issueDate)}</td>
                      <td>{formatDate(quote.expiryDate)}</td>
                      <td>{formatMinorCurrency(quote.totalMinor)}</td>
                      <td>
                        <div className="dl-inline-actions">
                          <Link to={`/quotes/${quote.id}`}>View</Link>
                          {quote.status === 'draft' ? (
                            <Button size="sm" type="button" onClick={() => handleTransition(quote.id, 'sent')}>
                              Mark Sent
                            </Button>
                          ) : null}
                          {quote.status === 'accepted' ? (
                            <Button size="sm" type="button" onClick={() => handleConvert(quote.id)}>
                              Convert
                            </Button>
                          ) : null}
                          <Button size="sm" type="button" onClick={() => handleDuplicate(quote.id)}>
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
                {filtered.map((quote) => {
                  const clientName = clientNameById.get(quote.clientId) ?? 'Unknown client';
                  return (
                    <article key={quote.id} className="dl-mobile-item">
                      <div className="dl-mobile-item-header">
                        <div>
                          <strong>{quote.quoteNumber}</strong>
                          <div className="dl-muted" style={{ fontSize: 12 }}>
                            {clientName}
                          </div>
                        </div>
                        <QuoteStatusBadge status={quote.status} />
                      </div>
                      <div className="dl-mobile-meta">
                        <div>
                          <span>Total</span>
                          <div>{formatMinorCurrency(quote.totalMinor)}</div>
                        </div>
                        <div>
                          <span>Expires</span>
                          <div>{formatDate(quote.expiryDate)}</div>
                        </div>
                      </div>
                      <div className="dl-inline-actions" style={{ marginTop: 12 }}>
                        <Link to={`/quotes/${quote.id}`}>Open</Link>
                        {quote.status === 'draft' ? (
                          <Button size="sm" type="button" onClick={() => handleTransition(quote.id, 'sent')}>
                            Mark Sent
                          </Button>
                        ) : null}
                        {quote.status === 'accepted' ? (
                          <Button size="sm" type="button" onClick={() => handleConvert(quote.id)}>
                            Convert
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
            Showing {filtered.length} quotes · Page 1 of 1
          </div>
        </>
      )}
    </>
  );
}
