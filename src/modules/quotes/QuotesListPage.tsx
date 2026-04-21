import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Button } from '@/design-system/primitives/Button';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { QuoteStatusBadge } from '@/design-system/patterns/StatusBadge';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { IconButton } from '@/design-system/primitives/IconButton';
import { formatDate, formatMinorCurrency } from '@/utils/format';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { matchesDateRange, matchesSearchText } from '@/modules/insights/domain/filters';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';

type SortFilter = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'number_desc' | 'number_asc';

export function QuotesListPage() {
  const navigate = useNavigate();
  const {
    quoteSummaries,
    transitionQuote,
    duplicateQuote,
    convertQuoteToInvoice,
    deleteQuote,
  } = useAccounting();
  const { clients, getClientNameById } = useMasterData();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [clientId, setClientId] = useState('all');
  const [issueDateFrom, setIssueDateFrom] = useState('');
  const [issueDateTo, setIssueDateTo] = useState('');
  const [sort, setSort] = useState<SortFilter>('date_desc');
  const [segment, setSegment] = useState<'all' | 'needs_action' | 'accepted_not_converted'>('all');
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [customFieldsVisible, setCustomFieldsVisible] = useState(false);

  const filtered = useMemo(() => {
    const rows = quoteSummaries.filter((quote) => {
      const statusMatch = status === 'all' || quote.status === status;
      const clientMatch = clientId === 'all' || quote.clientId === clientId;
      const issueDateMatch = matchesDateRange(quote.issueDate, issueDateFrom || undefined, issueDateTo || undefined);
      const segmentMatch =
        segment === 'all' ||
        (segment === 'accepted_not_converted' && quote.status === 'accepted') ||
        (segment === 'needs_action' && ['draft', 'sent', 'viewed', 'accepted'].includes(quote.status));

      const clientName = getClientNameById(quote.clientId);
      const searchMatch = matchesSearchText(search, [
        quote.quoteNumber,
        quote.referenceNumber ?? '',
        clientName,
        quote.status,
        quote.issueDate,
      ]);

      return statusMatch && clientMatch && issueDateMatch && segmentMatch && searchMatch;
    });

    rows.sort((a, b) => {
      if (sort === 'date_asc') return a.issueDate.localeCompare(b.issueDate);
      if (sort === 'amount_desc') return b.totalMinor - a.totalMinor;
      if (sort === 'amount_asc') return a.totalMinor - b.totalMinor;
      if (sort === 'number_desc') return b.quoteNumber.localeCompare(a.quoteNumber);
      if (sort === 'number_asc') return a.quoteNumber.localeCompare(b.quoteNumber);
      return b.issueDate.localeCompare(a.issueDate);
    });

    return rows;
  }, [clientId, getClientNameById, issueDateFrom, issueDateTo, quoteSummaries, search, segment, sort, status]);

  const acceptedAwaitingConversion = quoteSummaries.filter((quote) => quote.status === 'accepted').length;

  const handleTransition = (quoteId: string, target: 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired') => {
    const result = transitionQuote(quoteId, target);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? `Quote marked as ${target.replace('_', ' ')}.` : result.error ?? 'Action failed.',
    });
  };

  const handleDuplicate = (quoteId: string) => {
    const result = duplicateQuote(quoteId);
    if (result.ok && result.data) {
      navigate(`/quotes/${result.data.id}/edit`);
      return;
    }
    setNotice({ tone: 'error', text: result.error ?? 'Unable to duplicate quote.' });
  };

  const handleDelete = (quoteId: string, quoteNumber: string) => {
    const confirmed = window.confirm(`Delete quote "${quoteNumber}"?`);
    if (!confirmed) return;
    const result = deleteQuote(quoteId);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? `${quoteNumber} deleted.` : result.error ?? 'Unable to delete quote.',
    });
  };

  const handleConvert = (quoteId: string) => {
    const result = convertQuoteToInvoice(quoteId);
    if (result.ok && result.data) {
      navigate(`/invoices/${result.data.id}`);
      return;
    }
    setNotice({ tone: 'error', text: result.error ?? 'Unable to convert quote.' });
  };

  return (
    <>
      <PageHeader
        title="Quotes"
        subtitle={`Accepted awaiting conversion: ${acceptedAwaitingConversion}`}
        actions={
          <div className="dl-inline-actions">
            <Link to="/quotes/new">
              <Button variant="primary">New Quote</Button>
            </Link>
            <ListUtilityMenu
              open={utilityMenuOpen}
              onToggleOpen={() => setUtilityMenuOpen((previous) => !previous)}
              sort={sort}
              onSortChange={(nextSort) => {
                setSort(nextSort);
                setUtilityMenuOpen(false);
              }}
              onImportClick={() => {
                setUtilityMenuOpen(false);
                setNotice({ tone: 'info', text: 'Import quotes flow will be enabled in the next phase.' });
              }}
              onExportClick={() => {
                setUtilityMenuOpen(false);
                setNotice({ tone: 'success', text: `Export ready: ${filtered.length} quote row(s) prepared.` });
              }}
              onRefreshClick={() => {
                setUtilityMenuOpen(false);
                setNotice({ tone: 'success', text: 'Quote list refreshed.' });
              }}
              onTogglePreferences={() => {
                setUtilityMenuOpen(false);
                setNotice({ tone: 'info', text: 'Quote preferences can be changed from quote detail actions.' });
              }}
              onManageCustomFields={() => {
                setCustomFieldsVisible((previous) => !previous);
                setUtilityMenuOpen(false);
              }}
              onResetColumns={() => {
                setUtilityMenuOpen(false);
                setSort('date_desc');
                setIssueDateFrom('');
                setIssueDateTo('');
                setStatus('all');
                setClientId('all');
                setSegment('all');
                setSearch('');
                setNotice({ tone: 'success', text: 'Quote table preferences reset.' });
              }}
            />
          </div>
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}
      {customFieldsVisible ? (
        <InlineNotice tone="info">
          Quote custom fields can be introduced through template and module preference controls.
        </InlineNotice>
      ) : null}

      <FilterBar ariaLabel="Quote filters">
        <Select
          aria-label="Quote segment filter"
          value={segment}
          onChange={(event) =>
            setSegment(event.target.value as 'all' | 'needs_action' | 'accepted_not_converted')
          }
          options={[
            { label: 'All Quotes', value: 'all' },
            { label: 'Needs Action', value: 'needs_action' },
            { label: 'Accepted Awaiting Conversion', value: 'accepted_not_converted' },
          ]}
          style={{ width: 250 }}
        />
        <Input
          aria-label="Search quotes"
          placeholder="Search by quote #, reference, customer, status"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(360px, 100%)' }}
        />
        <Select
          aria-label="Client filter"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          options={[
            { label: 'All customers', value: 'all' },
            ...clients.map((client) => ({ label: client.displayName, value: client.id })),
          ]}
          style={{ width: 220 }}
        />
        <Select
          aria-label="Quote status filter"
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
          aria-label="Quote date from"
          type="date"
          value={issueDateFrom}
          onChange={(event) => setIssueDateFrom(event.target.value)}
          style={{ width: 170 }}
        />
        <Input
          aria-label="Quote date to"
          type="date"
          value={issueDateTo}
          onChange={(event) => setIssueDateTo(event.target.value)}
          style={{ width: 170 }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No quotes found"
          description="Try adjusting filters, or create a new quote."
          action={
            <Link to="/quotes/new">
              <Button variant="primary">Create Quote</Button>
            </Link>
          }
        />
      ) : (
        <>
          <ResponsiveList
            headers={['Date', 'Quote Number', 'Reference', 'Customer', 'Status', 'Amount', 'Actions']}
            desktopRows={
              <>
                {filtered.map((quote) => {
                  const clientName = getClientNameById(quote.clientId);

                  return (
                    <tr key={quote.id}>
                      <td>{formatDate(quote.issueDate)}</td>
                      <td>
                        <Link to={`/quotes/${quote.id}`}><strong>{quote.quoteNumber}</strong></Link>
                      </td>
                      <td>{quote.referenceNumber || '—'}</td>
                      <td>{clientName}</td>
                      <td>
                        <QuoteStatusBadge status={quote.status} />
                      </td>
                      <td>{formatMinorCurrency(quote.totalMinor)}</td>
                      <td>
                        <QuoteRowActionsMenu
                          quoteId={quote.id}
                          quoteNumber={quote.quoteNumber}
                          status={quote.status}
                          onMarkSent={() => handleTransition(quote.id, 'sent')}
                          onConvert={() => handleConvert(quote.id)}
                          onDuplicate={() => handleDuplicate(quote.id)}
                          onDelete={() => handleDelete(quote.id, quote.quoteNumber)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </>
            }
            mobileCards={
              <>
                {filtered.map((quote) => {
                  const clientName = getClientNameById(quote.clientId);
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
                          <span>Date</span>
                          <div>{formatDate(quote.issueDate)}</div>
                        </div>
                        <div>
                          <span>Reference</span>
                          <div>{quote.referenceNumber || '—'}</div>
                        </div>
                        <div>
                          <span>Amount</span>
                          <div>{formatMinorCurrency(quote.totalMinor)}</div>
                        </div>
                      </div>
                      <div className="dl-inline-actions" style={{ marginTop: 12 }}>
                        <Link to={`/quotes/${quote.id}`}>
                          <Button size="sm" variant="secondary">Open</Button>
                        </Link>
                        {quote.status === 'draft' ? (
                          <Button size="sm" type="button" onClick={() => handleTransition(quote.id, 'sent')}>
                            Mark as Sent
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
                    </article>
                  );
                })}
              </>
            }
          />
          <div className="dl-list-footer">
            Showing {filtered.length} quote(s) · Page 1 of 1
          </div>
        </>
      )}
    </>
  );
}

interface ListUtilityMenuProps {
  open: boolean;
  sort: SortFilter;
  onToggleOpen: () => void;
  onSortChange: (value: SortFilter) => void;
  onImportClick: () => void;
  onExportClick: () => void;
  onRefreshClick: () => void;
  onTogglePreferences: () => void;
  onManageCustomFields: () => void;
  onResetColumns: () => void;
}

function ListUtilityMenu(props: ListUtilityMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);

  const updatePopoverPosition = () => {
    if (!rootRef.current) return;
    const triggerRect = rootRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const estimatedMenuHeight = 296;
    const viewportPadding = 8;
    const top = Math.min(window.innerHeight - estimatedMenuHeight - viewportPadding, triggerRect.bottom + 6);
    const left = Math.max(
      viewportPadding,
      Math.min(window.innerWidth - menuWidth - viewportPadding, triggerRect.right - menuWidth),
    );
    setPopoverStyle({
      position: 'fixed',
      top,
      left,
      width: menuWidth,
      zIndex: 120,
    });
  };

  useEffect(() => {
    if (!props.open) return;
    updatePopoverPosition();
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      props.onToggleOpen();
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
  }, [props.open, props]);

  return (
    <div className="dl-row-action-menu" ref={rootRef}>
      <IconButton
        icon="⋯"
        label="Quote list actions"
        className="dl-row-action-trigger"
        onClick={props.onToggleOpen}
      />
      {props.open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-row-action-popover"
              role="menu"
              aria-label="Quote list actions"
              style={popoverStyle}
            >
              <button type="button" className="dl-row-action-item" onClick={() => props.onSortChange('date_desc')}>
                Sort by Quote Date (Newest)
              </button>
              <button type="button" className="dl-row-action-item" onClick={() => props.onSortChange('date_asc')}>
                Sort by Quote Date (Oldest)
              </button>
              <button type="button" className="dl-row-action-item" onClick={() => props.onSortChange('amount_desc')}>
                Sort by Amount (High to Low)
              </button>
              <button type="button" className="dl-row-action-item" onClick={() => props.onSortChange('amount_asc')}>
                Sort by Amount (Low to High)
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onImportClick}>
                Import Quotes
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onExportClick}>
                Export Quotes
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onTogglePreferences}>
                Preferences
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onManageCustomFields}>
                Manage Custom Fields
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onRefreshClick}>
                Refresh List
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onResetColumns}>
                Reset Column Width
              </button>
              <div className="dl-muted" style={{ fontSize: 11, padding: '6px 10px' }}>
                Current sort: {props.sort.replace('_', ' ')}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

interface QuoteRowActionsMenuProps {
  quoteId: string;
  quoteNumber: string;
  status: string;
  onMarkSent: () => void;
  onConvert: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function QuoteRowActionsMenu({
  quoteId,
  quoteNumber,
  status,
  onMarkSent,
  onConvert,
  onDuplicate,
  onDelete,
}: QuoteRowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updatePopoverPosition = () => {
    if (!rootRef.current) return;

    const triggerRect = rootRef.current.getBoundingClientRect();
    const menuWidth = 194;
    const estimatedMenuHeight = 180;
    const viewportPadding = 8;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const shouldOpenUp = spaceBelow < estimatedMenuHeight + viewportPadding;
    const top = shouldOpenUp
      ? Math.max(viewportPadding, triggerRect.top - estimatedMenuHeight - 6)
      : Math.min(window.innerHeight - estimatedMenuHeight - viewportPadding, triggerRect.bottom + 6);
    const left = Math.max(
      viewportPadding,
      Math.min(window.innerWidth - menuWidth - viewportPadding, triggerRect.right - menuWidth),
    );

    setPopoverStyle({
      position: 'fixed',
      top,
      left,
      width: menuWidth,
      zIndex: 120,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePopoverPosition();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
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
  }, [open]);

  const closeAndRun = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  return (
    <div className="dl-row-action-menu" ref={rootRef}>
      <IconButton
        icon="⋯"
        label={`Actions for ${quoteNumber}`}
        className="dl-row-action-trigger"
        onClick={() => setOpen((previous) => !previous)}
      />
      {open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-row-action-popover"
              role="menu"
              aria-label={`Actions for ${quoteNumber}`}
              style={popoverStyle}
            >
              <Link to={`/quotes/${quoteId}`} className="dl-row-action-item" onClick={() => setOpen(false)}>
                Open Quote
              </Link>
              {status === 'draft' ? (
                <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(onMarkSent)}>
                  Mark as Sent
                </button>
              ) : null}
              {status === 'accepted' ? (
                <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(onConvert)}>
                  Convert to Invoice
                </button>
              ) : null}
              <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(onDuplicate)}>
                Duplicate
              </button>
              <button type="button" className="dl-row-action-item danger" onClick={() => closeAndRun(onDelete)}>
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
