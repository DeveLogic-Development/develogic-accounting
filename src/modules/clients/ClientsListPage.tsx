import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { formatCurrency, formatDate } from '@/utils/format';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Button } from '@/design-system/primitives/Button';
import { Badge } from '@/design-system/primitives/Badge';
import { IconButton } from '@/design-system/primitives/IconButton';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { Skeleton } from '@/design-system/patterns/Skeleton';
import { InlineNotice } from '@/design-system/patterns/InlineNotice';
import { matchesSearchText } from '@/modules/insights/domain/filters';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';

type SegmentFilter = 'all' | 'with_outstanding' | 'high_outstanding';
type StatusFilter = 'all' | 'active' | 'inactive';
type TypeFilter = 'all' | 'business' | 'individual';
type SortFilter = 'recent' | 'outstanding_desc' | 'name_asc';
type SelectOption = { label: string; value: string };

const CUSTOMER_TYPE_OPTIONS: SelectOption[] = [
  { label: 'All Types', value: 'all' },
  { label: 'Business', value: 'business' },
  { label: 'Individual', value: 'individual' },
];

const SEGMENT_OPTIONS: SelectOption[] = [
  { label: 'All Segments', value: 'all' },
  { label: 'With Outstanding', value: 'with_outstanding' },
  { label: 'Outstanding >= R10,000', value: 'high_outstanding' },
];

const STATUS_OPTIONS: SelectOption[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const SORT_OPTIONS: SelectOption[] = [
  { label: 'Sort: Recent Activity', value: 'recent' },
  { label: 'Sort: Outstanding High', value: 'outstanding_desc' },
  { label: 'Sort: Name A-Z', value: 'name_asc' },
];

export function ClientsListPage() {
  const { clients, loading, deleteClient } = useMasterData();
  const { invoiceSummaries, state } = useAccounting();
  const [mobileFiltersEnabled, setMobileFiltersEnabled] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [segment, setSegment] = useState<SegmentFilter>('all');
  const [customerType, setCustomerType] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<SortFilter>('recent');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const apply = () => setMobileFiltersEnabled(media.matches);

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  const filtered = useMemo(() => {
    const metricsByClient = new Map<
      string,
      { outstandingBalance: number; lastActivityAt?: string }
    >();

    invoiceSummaries.forEach((invoice) => {
      const current = metricsByClient.get(invoice.clientId) ?? {
        outstandingBalance: 0,
      };
      current.outstandingBalance += invoice.outstandingMinor / 100;
      current.lastActivityAt = [current.lastActivityAt, invoice.issueDate]
        .filter(Boolean)
        .sort()
        .at(-1);
      metricsByClient.set(invoice.clientId, current);
    });

    state.quotes.forEach((quote) => {
      const current = metricsByClient.get(quote.clientId) ?? {
        outstandingBalance: 0,
      };
      current.lastActivityAt = [current.lastActivityAt, quote.issueDate]
        .filter(Boolean)
        .sort()
        .at(-1);
      metricsByClient.set(quote.clientId, current);
    });

    const rows = clients
      .map((client) => {
        const metrics = metricsByClient.get(client.id);
        const fallbackActivity = client.updatedAt || client.createdAt;
        const workPhone =
          [client.workPhoneCountryCode, client.workPhoneNumber]
            .filter(Boolean)
            .join(' ') ||
          client.phone ||
          'N/A';
        return {
          ...client,
          status: client.isActive ? 'active' : 'inactive',
          outstandingBalance: metrics?.outstandingBalance ?? 0,
          unusedCredits: client.unusedCredits ?? 0,
          lastActivityAt: metrics?.lastActivityAt ?? fallbackActivity,
          workPhone,
        };
      })
      .filter((client) => {
        const statusMatch = status === 'all' || client.status === status;
        const segmentMatch =
          segment === 'all' ||
          (segment === 'with_outstanding' && client.outstandingBalance > 0) ||
          (segment === 'high_outstanding' && client.outstandingBalance >= 10000);
        const typeMatch = customerType === 'all' || client.customerType === customerType;
        const searchMatch = matchesSearchText(search, [
          client.displayName,
          client.companyName,
          client.email,
          client.workPhone,
        ]);

        return statusMatch && segmentMatch && typeMatch && searchMatch;
      });

    rows.sort((a, b) => {
      if (sort === 'outstanding_desc') return b.outstandingBalance - a.outstandingBalance;
      if (sort === 'name_asc') return a.displayName.localeCompare(b.displayName);
      return b.lastActivityAt.localeCompare(a.lastActivityAt);
    });

    return rows;
  }, [clients, invoiceSummaries, search, segment, sort, state.quotes, status, customerType]);

  const handleDeleteClient = async (clientId: string, displayName: string) => {
    const confirmed = window.confirm(
      `Delete customer "${displayName}"? This will hide it from active records.`,
    );
    if (!confirmed) return;

    setNotice(null);
    setDeletingClientId(clientId);
    const result = await deleteClient(clientId);
    setDeletingClientId(null);

    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to delete customer.' });
      return;
    }

    setNotice({ tone: 'success', text: `Customer "${displayName}" deleted.` });
  };

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Accounting customer workspace with receivables, contacts, and customer activity."
        actions={
          <Link to="/clients/new">
            <Button variant="primary">New Customer</Button>
          </Link>
        }
      />

      <FilterBar ariaLabel="Customer filters">
        <Input
          aria-label="Search customers"
          placeholder="Search by name, company, email or phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(360px, 100%)' }}
        />
        {mobileFiltersEnabled ? (
          <MobileFilterSelect
            ariaLabel="Customer type filter"
            value={customerType}
            options={CUSTOMER_TYPE_OPTIONS}
            onChange={(next) => setCustomerType(next as TypeFilter)}
          />
        ) : (
          <Select
            aria-label="Customer type filter"
            value={customerType}
            onChange={(event) => setCustomerType(event.target.value as TypeFilter)}
            options={CUSTOMER_TYPE_OPTIONS}
            style={{ width: 180 }}
          />
        )}
        {mobileFiltersEnabled ? (
          <MobileFilterSelect
            ariaLabel="Customer segment filter"
            value={segment}
            options={SEGMENT_OPTIONS}
            onChange={(next) => setSegment(next as SegmentFilter)}
          />
        ) : (
          <Select
            aria-label="Customer segment filter"
            value={segment}
            onChange={(event) => setSegment(event.target.value as SegmentFilter)}
            options={SEGMENT_OPTIONS}
            style={{ width: 230 }}
          />
        )}
        {mobileFiltersEnabled ? (
          <MobileFilterSelect
            ariaLabel="Customer status filter"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(next) => setStatus(next as StatusFilter)}
          />
        ) : (
          <Select
            aria-label="Customer status filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            options={STATUS_OPTIONS}
            style={{ width: 170 }}
          />
        )}
        {mobileFiltersEnabled ? (
          <MobileFilterSelect
            ariaLabel="Sort customers"
            value={sort}
            options={SORT_OPTIONS}
            onChange={(next) => setSort(next as SortFilter)}
          />
        ) : (
          <Select
            aria-label="Sort customers"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortFilter)}
            options={SORT_OPTIONS}
            style={{ width: 210 }}
          />
        )}
      </FilterBar>

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      {loading ? (
        <div className="dl-card" style={{ display: 'grid', gap: 12 }}>
          <Skeleton height={18} />
          <Skeleton height={18} />
          <Skeleton height={18} />
          <Skeleton height={18} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No customers found"
          description="Try adjusting your filters or create a new customer profile."
          action={
            <Link to="/clients/new">
              <Button variant="primary">Create Customer</Button>
            </Link>
          }
        />
      ) : (
        <>
          <ResponsiveList
            headers={[
              'Customer',
              'Company',
              'Email',
              'Work Phone',
              'Receivables',
              'Unused Credits',
              'Status',
              'Actions',
            ]}
            desktopRows={
              <>
                {filtered.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.displayName}</strong>
                      <div className="dl-muted" style={{ fontSize: 12 }}>
                        {client.customerType === 'business' ? 'Business' : 'Individual'}
                      </div>
                    </td>
                    <td>{client.companyName || '—'}</td>
                    <td>{client.email || '—'}</td>
                    <td>{client.workPhone}</td>
                    <td>{formatCurrency(client.outstandingBalance)}</td>
                    <td>{formatCurrency(client.unusedCredits)}</td>
                    <td>
                      <Badge variant={client.status === 'active' ? 'success' : 'neutral'}>
                        {client.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div className="dl-inline-actions">
                        <RowActionsMenu
                          clientId={client.id}
                          displayName={client.displayName}
                          isDeleting={deletingClientId === client.id}
                          onDelete={handleDeleteClient}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            }
            mobileCards={
              <>
                {filtered.map((client) => (
                  <article key={client.id} className="dl-mobile-item">
                    <div className="dl-mobile-item-header">
                      <div>
                        <strong>{client.displayName}</strong>
                        <div className="dl-muted" style={{ fontSize: 12 }}>
                          {client.companyName || client.customerType}
                        </div>
                      </div>
                      <Badge variant={client.status === 'active' ? 'success' : 'neutral'}>
                        {client.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="dl-mobile-meta">
                      <div>
                        <span>Receivables</span>
                        <div>{formatCurrency(client.outstandingBalance)}</div>
                      </div>
                      <div>
                        <span>Unused Credits</span>
                        <div>{formatCurrency(client.unusedCredits)}</div>
                      </div>
                      <div>
                        <span>Email</span>
                        <div>{client.email || '—'}</div>
                      </div>
                      <div>
                        <span>Last Activity</span>
                        <div>{formatDate(client.lastActivityAt)}</div>
                      </div>
                    </div>

                    <div className="dl-inline-actions" style={{ marginTop: 12 }}>
                      <RowActionsMenu
                        clientId={client.id}
                        displayName={client.displayName}
                        isDeleting={deletingClientId === client.id}
                        onDelete={handleDeleteClient}
                      />
                    </div>
                  </article>
                ))}
              </>
            }
          />
          <div className="dl-list-footer">
            Showing {filtered.length} customers · Page 1 of 1
          </div>
        </>
      )}
    </>
  );
}

interface MobileFilterSelectProps {
  ariaLabel: string;
  value: string;
  options: SelectOption[];
  onChange: (nextValue: string) => void;
}

function MobileFilterSelect({ ariaLabel, value, options, onChange }: MobileFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? '';

  const updatePopoverPosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 10;
    const width = Math.max(240, Math.min(window.innerWidth - viewportPadding * 2, triggerRect.width));
    const itemHeight = 52;
    const menuHeight = Math.min(360, Math.max(72, options.length * itemHeight + 12));
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const shouldOpenUp = spaceBelow < menuHeight + viewportPadding;

    const top = shouldOpenUp
      ? Math.max(viewportPadding, triggerRect.top - menuHeight - 8)
      : Math.min(window.innerHeight - menuHeight - viewportPadding, triggerRect.bottom + 8);
    const left = Math.max(
      viewportPadding,
      Math.min(window.innerWidth - width - viewportPadding, triggerRect.left),
    );

    setPopoverStyle({
      position: 'fixed',
      top,
      left,
      width,
      maxHeight: menuHeight,
      zIndex: 220,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePopoverPosition();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
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
  }, [open, options.length]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div className="dl-mobile-filter-select">
      <button
        ref={triggerRef}
        type="button"
        className="dl-mobile-filter-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span>{selectedLabel}</span>
        <span aria-hidden>⌄</span>
      </button>
      {open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-mobile-filter-select-popover"
              role="listbox"
              aria-label={ariaLabel}
              style={popoverStyle}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="dl-mobile-filter-select-option"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => handleSelect(option.value)}
                >
                  <span aria-hidden>{option.value === value ? '✓' : ''}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

interface RowActionsMenuProps {
  clientId: string;
  displayName: string;
  isDeleting: boolean;
  onDelete: (clientId: string, displayName: string) => Promise<void>;
}

function RowActionsMenu({ clientId, displayName, isDeleting, onDelete }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updatePopoverPosition = () => {
    if (!rootRef.current) return;

    const triggerRect = rootRef.current.getBoundingClientRect();
    const menuWidth = 176;
    const estimatedMenuHeight = 132;
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
      const clickedTrigger = rootRef.current?.contains(target);
      const clickedPopover = popoverRef.current?.contains(target);
      if (!clickedTrigger && !clickedPopover) {
        setOpen(false);
      }
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

  const handleDelete = async () => {
    setOpen(false);
    await onDelete(clientId, displayName);
  };

  return (
    <div className="dl-row-action-menu" ref={rootRef}>
      <IconButton
        icon="⋯"
        label="Row actions"
        className="dl-row-action-trigger"
        onClick={() => setOpen((previous) => !previous)}
      />
      {open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-row-action-popover"
              role="menu"
              aria-label={`Actions for ${displayName}`}
              style={popoverStyle}
            >
              <Link
                to={`/clients/${clientId}`}
                className="dl-row-action-item"
                onClick={() => setOpen(false)}
              >
                View Details
              </Link>
              <Link
                to={`/clients/${clientId}/edit`}
                className="dl-row-action-item"
                onClick={() => setOpen(false)}
              >
                Edit
              </Link>
              <button
                type="button"
                className="dl-row-action-item danger"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
