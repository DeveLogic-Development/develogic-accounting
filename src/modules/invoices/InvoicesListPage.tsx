import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Button } from '@/design-system/primitives/Button';
import { IconButton } from '@/design-system/primitives/IconButton';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { InvoiceStatusBadge } from '@/design-system/patterns/StatusBadge';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { formatDate, formatMinorCurrency } from '@/utils/format';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { matchesDateRange, matchesSearchText } from '@/modules/insights/domain/filters';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { InvoiceSummary } from '@/modules/accounting/domain/types';

type SortFilter =
  | 'date_desc'
  | 'date_asc'
  | 'due_desc'
  | 'due_asc'
  | 'amount_desc'
  | 'amount_asc'
  | 'number_desc'
  | 'number_asc';

type SegmentFilter = 'all' | 'needs_collection' | 'pending_review' | 'overdue' | 'paid';

function paymentSubmissionStateLabel(
  state: InvoiceSummary['paymentSubmissionState'],
  pendingCount?: number,
): string {
  if (state === 'submitted') return `POP Submitted${pendingCount && pendingCount > 1 ? ` (${pendingCount})` : ''}`;
  if (state === 'under_review') return `POP Under Review${pendingCount && pendingCount > 1 ? ` (${pendingCount})` : ''}`;
  if (state === 'rejected') return 'POP Rejected';
  if (state === 'approved') return 'POP Approved';
  return 'POP';
}

function paymentSubmissionStateTone(
  state: InvoiceSummary['paymentSubmissionState'],
): 'info' | 'warning' | 'danger' | 'success' | 'neutral' {
  if (state === 'submitted') return 'info';
  if (state === 'under_review') return 'warning';
  if (state === 'rejected') return 'danger';
  if (state === 'approved') return 'success';
  return 'neutral';
}

export function InvoicesListPage() {
  const navigate = useNavigate();
  const {
    invoiceSummaries,
    duplicateInvoice,
    transitionInvoice,
    deleteInvoice,
  } = useAccounting();
  const { clients, getClientNameById } = useMasterData();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [clientId, setClientId] = useState('all');
  const [issueDateFrom, setIssueDateFrom] = useState('');
  const [issueDateTo, setIssueDateTo] = useState('');
  const [dueBefore, setDueBefore] = useState('');
  const [segment, setSegment] = useState<SegmentFilter>('all');
  const [sort, setSort] = useState<SortFilter>('date_desc');
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [customFieldsVisible, setCustomFieldsVisible] = useState(false);
  const [onlinePaymentsHintVisible, setOnlinePaymentsHintVisible] = useState(false);

  const filtered = useMemo(() => {
    const rows = invoiceSummaries.filter((invoice) => {
      const statusMatch = status === 'all' || invoice.status === status;
      const clientMatch = clientId === 'all' || invoice.clientId === clientId;
      const issueDateMatch = matchesDateRange(
        invoice.issueDate,
        issueDateFrom || undefined,
        issueDateTo || undefined,
      );
      const dueMatch = dueBefore.length === 0 || invoice.dueDate <= dueBefore;
      const hasPendingSubmission =
        invoice.paymentSubmissionState === 'submitted' ||
        invoice.paymentSubmissionState === 'under_review';
      const segmentMatch =
        segment === 'all'
        || (segment === 'overdue' && invoice.status === 'overdue')
        || (segment === 'paid' && invoice.status === 'paid')
        || (segment === 'pending_review' && hasPendingSubmission)
        || (
          segment === 'needs_collection'
          && invoice.outstandingMinor > 0
          && invoice.status !== 'void'
        );
      const clientName = getClientNameById(invoice.clientId);
      const searchMatch = matchesSearchText(search, [
        invoice.invoiceNumber,
        invoice.orderNumber ?? '',
        clientName,
        invoice.status,
        invoice.salesperson ?? '',
      ]);

      return statusMatch && clientMatch && issueDateMatch && dueMatch && segmentMatch && searchMatch;
    });

    rows.sort((a, b) => {
      if (sort === 'date_asc') return a.issueDate.localeCompare(b.issueDate);
      if (sort === 'due_desc') return b.dueDate.localeCompare(a.dueDate);
      if (sort === 'due_asc') return a.dueDate.localeCompare(b.dueDate);
      if (sort === 'amount_desc') return b.totalMinor - a.totalMinor;
      if (sort === 'amount_asc') return a.totalMinor - b.totalMinor;
      if (sort === 'number_desc') return b.invoiceNumber.localeCompare(a.invoiceNumber);
      if (sort === 'number_asc') return a.invoiceNumber.localeCompare(b.invoiceNumber);
      return b.issueDate.localeCompare(a.issueDate);
    });

    return rows;
  }, [
    clientId,
    dueBefore,
    getClientNameById,
    invoiceSummaries,
    issueDateFrom,
    issueDateTo,
    search,
    segment,
    sort,
    status,
  ]);

  const overdueCount = invoiceSummaries.filter((invoice) => invoice.status === 'overdue').length;
  const outstandingTotalMinor = invoiceSummaries.reduce((sum, invoice) => sum + invoice.outstandingMinor, 0);

  const handleDuplicate = (invoiceId: string) => {
    const result = duplicateInvoice(invoiceId);
    if (result.ok && result.data) {
      navigate(`/invoices/${result.data.id}/edit`);
      return;
    }

    setNotice({ tone: 'error', text: result.error ?? 'Unable to duplicate invoice.' });
  };

  const handleMarkAsSent = (invoice: InvoiceSummary) => {
    if (invoice.status === 'sent') {
      setNotice({ tone: 'info', text: `${invoice.invoiceNumber} is already sent.` });
      return;
    }

    const sendResult = transitionInvoice(invoice.id, 'sent', 'Marked sent from invoice list.');
    setNotice({
      tone: sendResult.ok ? 'success' : 'error',
      text: sendResult.ok ? `${invoice.invoiceNumber} marked as sent.` : sendResult.error ?? 'Unable to mark as sent.',
    });
  };

  const handleVoid = (invoiceId: string, invoiceNumber: string) => {
    const result = transitionInvoice(invoiceId, 'void', 'Voided from invoice list.');
    setNotice({
      tone: result.ok ? 'warning' : 'error',
      text: result.ok ? `${invoiceNumber} has been voided.` : result.error ?? 'Unable to void invoice.',
    });
  };

  const handleDelete = (invoiceId: string, invoiceNumber: string) => {
    const confirmed = window.confirm(`Delete invoice "${invoiceNumber}"?`);
    if (!confirmed) return;
    const result = deleteInvoice(invoiceId);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? `${invoiceNumber} deleted.` : result.error ?? 'Unable to delete invoice.',
    });
  };

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setClientId('all');
    setIssueDateFrom('');
    setIssueDateTo('');
    setDueBefore('');
    setSegment('all');
    setSort('date_desc');
  };

  return (
    <div className="dl-invoices-list-page">
      <PageHeader
        title="Invoices"
        subtitle={`Overdue: ${overdueCount} · Outstanding: ${formatMinorCurrency(outstandingTotalMinor)}`}
        actions={
          <div className="dl-inline-actions">
            <SplitNewMenu
              open={newMenuOpen}
              onToggle={() => setNewMenuOpen((previous) => !previous)}
              onCreateInvoice={() => {
                setNewMenuOpen(false);
                navigate('/invoices/new');
              }}
              onCreateRecurring={() => {
                setNewMenuOpen(false);
                navigate('/invoices/recurring');
              }}
              onCreateCreditNote={() => {
                setNewMenuOpen(false);
                setNotice({
                  tone: 'info',
                  text: 'Credit note creation will open from an eligible invoice context.',
                });
              }}
            />
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
                setNotice({ tone: 'info', text: 'Import invoices flow will be enabled in the next pass.' });
              }}
              onExportClick={() => {
                setUtilityMenuOpen(false);
                setNotice({ tone: 'success', text: `Export ready: ${filtered.length} invoice row(s) prepared.` });
              }}
              onRefreshClick={() => {
                setUtilityMenuOpen(false);
                setNotice({ tone: 'success', text: 'Invoice list refreshed.' });
              }}
              onTogglePreferences={() => {
                setUtilityMenuOpen(false);
                setNotice({ tone: 'info', text: 'Invoice display preferences updated for this session.' });
              }}
              onManageCustomFields={() => {
                setCustomFieldsVisible((previous) => !previous);
                setUtilityMenuOpen(false);
              }}
              onOnlinePayments={() => {
                setOnlinePaymentsHintVisible((previous) => !previous);
                setUtilityMenuOpen(false);
              }}
              onResetColumns={() => {
                setUtilityMenuOpen(false);
                resetFilters();
                setNotice({ tone: 'success', text: 'Invoice table preferences reset.' });
              }}
            />
          </div>
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}
      {customFieldsVisible ? (
        <InlineNotice tone="info">
          Invoice custom fields can be surfaced through module preferences and template mappings.
        </InlineNotice>
      ) : null}
      {onlinePaymentsHintVisible ? (
        <InlineNotice tone="info">
          Online payments are available as a configured integration hook. Connect your payment gateway in settings.
        </InlineNotice>
      ) : null}

      <FilterBar ariaLabel="Invoice filters">
        <Select
          aria-label="Invoice segment filter"
          value={segment}
          onChange={(event) => setSegment(event.target.value as SegmentFilter)}
          options={[
            { label: 'All Invoices', value: 'all' },
            { label: 'Needs Collection', value: 'needs_collection' },
            { label: 'Proof Pending Review', value: 'pending_review' },
            { label: 'Overdue', value: 'overdue' },
            { label: 'Paid', value: 'paid' },
          ]}
          style={{ width: 220 }}
        />
        <Input
          aria-label="Search invoices"
          placeholder="Search invoice #, order #, customer, status"
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
          aria-label="Invoice status filter"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { label: 'All statuses', value: 'all' },
            { label: 'Draft', value: 'draft' },
            { label: 'Open', value: 'approved' },
            { label: 'Sent', value: 'sent' },
            { label: 'Partially Paid', value: 'partially_paid' },
            { label: 'Paid', value: 'paid' },
            { label: 'Overdue', value: 'overdue' },
            { label: 'Void', value: 'void' },
          ]}
          style={{ width: 180 }}
        />
        <Input
          aria-label="Issue date from"
          type="date"
          value={issueDateFrom}
          onChange={(event) => setIssueDateFrom(event.target.value)}
          style={{ width: 170 }}
        />
        <Input
          aria-label="Issue date to"
          type="date"
          value={issueDateTo}
          onChange={(event) => setIssueDateTo(event.target.value)}
          style={{ width: 170 }}
        />
        <Input
          aria-label="Due before date"
          type="date"
          value={dueBefore}
          onChange={(event) => setDueBefore(event.target.value)}
          style={{ width: 170 }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description="Try changing filters, or create a new invoice."
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
              'Date',
              'Invoice #',
              'Order Number',
              'Customer',
              'Status',
              'Due Date',
              'Amount',
              'Balance Due',
              'Actions',
            ]}
            desktopRows={
              <>
                {filtered.map((invoice) => {
                  const clientName = getClientNameById(invoice.clientId);

                  return (
                    <tr key={invoice.id}>
                      <td>{formatDate(invoice.issueDate)}</td>
                      <td>
                        <Link to={`/invoices/${invoice.id}`}>
                          <strong>{invoice.invoiceNumber}</strong>
                        </Link>
                      </td>
                      <td>{invoice.orderNumber || '—'}</td>
                      <td>{clientName}</td>
                      <td>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <InvoiceStatusBadge status={invoice.status} />
                          {invoice.paymentSubmissionState && invoice.paymentSubmissionState !== 'none' ? (
                            <span className={`dl-badge ${paymentSubmissionStateTone(invoice.paymentSubmissionState)}`}>
                              {paymentSubmissionStateLabel(
                                invoice.paymentSubmissionState,
                                invoice.pendingSubmissionCount,
                              )}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>{formatDate(invoice.dueDate)}</td>
                      <td>{formatMinorCurrency(invoice.totalMinor)}</td>
                      <td>{formatMinorCurrency(invoice.outstandingMinor)}</td>
                      <td>
                        <InvoiceRowActionsMenu
                          invoice={invoice}
                          onOpen={() => navigate(`/invoices/${invoice.id}`)}
                          onEdit={() => navigate(`/invoices/${invoice.id}/edit`)}
                          onMarkSent={() => handleMarkAsSent(invoice)}
                          onRecordPayment={() => navigate(`/invoices/${invoice.id}`)}
                          onDuplicate={() => handleDuplicate(invoice.id)}
                          onVoid={() => handleVoid(invoice.id, invoice.invoiceNumber)}
                          onDelete={() => handleDelete(invoice.id, invoice.invoiceNumber)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </>
            }
            mobileCards={
              <>
                {filtered.map((invoice) => {
                  const clientName = getClientNameById(invoice.clientId);
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
                          <span>Due Date</span>
                          <div>{formatDate(invoice.dueDate)}</div>
                        </div>
                        <div>
                          <span>Amount</span>
                          <div>{formatMinorCurrency(invoice.totalMinor)}</div>
                        </div>
                        <div>
                          <span>Balance Due</span>
                          <div>{formatMinorCurrency(invoice.outstandingMinor)}</div>
                        </div>
                      </div>
                      {invoice.paymentSubmissionState && invoice.paymentSubmissionState !== 'none' ? (
                        <div style={{ marginTop: 8 }}>
                          <span className={`dl-badge ${paymentSubmissionStateTone(invoice.paymentSubmissionState)}`}>
                            {paymentSubmissionStateLabel(invoice.paymentSubmissionState, invoice.pendingSubmissionCount)}
                          </span>
                        </div>
                      ) : null}
                      <div className="dl-inline-actions" style={{ marginTop: 12 }}>
                        <Link to={`/invoices/${invoice.id}`}>
                          <Button size="sm" variant="secondary">Open</Button>
                        </Link>
                        {(invoice.status === 'draft' || invoice.status === 'approved') ? (
                          <Button size="sm" type="button" onClick={() => handleMarkAsSent(invoice)}>
                            Mark as Sent
                          </Button>
                        ) : null}
                        <Button size="sm" type="button" onClick={() => handleDuplicate(invoice.id)}>
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
            Showing {filtered.length} invoice(s) · Page 1 of 1
          </div>
        </>
      )}
    </div>
  );
}

interface SplitNewMenuProps {
  open: boolean;
  onToggle: () => void;
  onCreateInvoice: () => void;
  onCreateRecurring: () => void;
  onCreateCreditNote: () => void;
}

function SplitNewMenu(props: SplitNewMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);

  const updatePopoverPosition = () => {
    if (!rootRef.current) return;
    const triggerRect = rootRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const estimatedMenuHeight = 164;
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
      zIndex: 130,
    });
  };

  useEffect(() => {
    if (!props.open) return;
    updatePopoverPosition();
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      props.onToggle();
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
  }, [props]);

  return (
    <div className="dl-row-action-menu" ref={rootRef}>
      <Button
        variant="primary"
        onClick={props.onToggle}
        aria-haspopup="menu"
        aria-expanded={props.open}
      >
        New Invoice <span aria-hidden="true">▾</span>
      </Button>
      {props.open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-row-action-popover"
              role="menu"
              aria-label="New invoice actions"
              style={popoverStyle}
            >
              <button type="button" className="dl-row-action-item" onClick={props.onCreateInvoice}>
                New Invoice
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onCreateRecurring}>
                New Recurring Invoice
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onCreateCreditNote}>
                New Credit Note
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
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
  onOnlinePayments: () => void;
  onResetColumns: () => void;
}

function ListUtilityMenu(props: ListUtilityMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);

  const updatePopoverPosition = () => {
    if (!rootRef.current) return;
    const triggerRect = rootRef.current.getBoundingClientRect();
    const menuWidth = 228;
    const estimatedMenuHeight = 330;
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
      zIndex: 130,
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
  }, [props]);

  return (
    <div className="dl-row-action-menu" ref={rootRef}>
      <IconButton
        icon="⋯"
        label="Invoice list actions"
        className="dl-row-action-trigger"
        onClick={props.onToggleOpen}
      />
      {props.open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-row-action-popover"
              role="menu"
              aria-label="Invoice list actions"
              style={popoverStyle}
            >
              <button type="button" className="dl-row-action-item" onClick={() => props.onSortChange('date_desc')}>
                Sort by Date (Newest)
              </button>
              <button type="button" className="dl-row-action-item" onClick={() => props.onSortChange('due_asc')}>
                Sort by Due Date
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onImportClick}>
                Import Invoices
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onExportClick}>
                Export
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onTogglePreferences}>
                Preferences
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onManageCustomFields}>
                Manage Custom Fields
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onOnlinePayments}>
                Online Payments
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onRefreshClick}>
                Refresh List
              </button>
              <button type="button" className="dl-row-action-item" onClick={props.onResetColumns}>
                Reset Column Width
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

interface InvoiceRowActionsMenuProps {
  invoice: InvoiceSummary;
  onOpen: () => void;
  onEdit: () => void;
  onMarkSent: () => void;
  onRecordPayment: () => void;
  onDuplicate: () => void;
  onVoid: () => void;
  onDelete: () => void;
}

function InvoiceRowActionsMenu(props: InvoiceRowActionsMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);

  const updatePopoverPosition = () => {
    if (!rootRef.current) return;
    const triggerRect = rootRef.current.getBoundingClientRect();
    const menuWidth = 190;
    const estimatedMenuHeight = 244;
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
      zIndex: 140,
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
        label={`Actions for ${props.invoice.invoiceNumber}`}
        className="dl-row-action-trigger"
        onClick={() => setOpen((previous) => !previous)}
      />
      {open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-row-action-popover"
              role="menu"
              aria-label={`Actions for ${props.invoice.invoiceNumber}`}
              style={popoverStyle}
            >
              <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(props.onOpen)}>
                Open
              </button>
              {props.invoice.status === 'draft' ? (
                <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(props.onEdit)}>
                  Edit Draft
                </button>
              ) : null}
              {(props.invoice.status === 'draft' || props.invoice.status === 'approved') ? (
                <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(props.onMarkSent)}>
                  Mark as Sent
                </button>
              ) : null}
              {props.invoice.status !== 'void' && props.invoice.status !== 'draft' && props.invoice.status !== 'paid' ? (
                <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(props.onRecordPayment)}>
                  Record Payment
                </button>
              ) : null}
              <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(props.onDuplicate)}>
                Clone
              </button>
              {props.invoice.status !== 'void' ? (
                <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(props.onVoid)}>
                  Void
                </button>
              ) : null}
              {props.invoice.status === 'draft' ? (
                <button type="button" className="dl-row-action-item danger" onClick={() => closeAndRun(props.onDelete)}>
                  Delete
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
