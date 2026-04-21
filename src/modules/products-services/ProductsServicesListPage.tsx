import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Button } from '@/design-system/primitives/Button';
import { IconButton } from '@/design-system/primitives/IconButton';
import { Badge } from '@/design-system/primitives/Badge';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { Skeleton } from '@/design-system/patterns/Skeleton';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { formatCurrency, formatMinorCurrency } from '@/utils/format';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { matchesSearchText } from '@/modules/insights/domain/filters';

type ItemTypeFilter = 'all' | 'goods' | 'service';
type StatusFilter = 'all' | 'active' | 'inactive';
type SortFilter = 'name_asc' | 'sales_desc' | 'purchase_desc' | 'usage_desc';

interface ListRow {
  id: string;
  name: string;
  type: 'goods' | 'service';
  purchaseDescription?: string;
  purchaseRate: number;
  salesDescription?: string;
  salesRate: number;
  usageUnit: string;
  status: 'active' | 'inactive';
  usageCount: number;
}

export function ProductsServicesListPage() {
  const {
    productsServices,
    loading,
    warning,
    refresh,
    cloneProductService,
    setProductServiceStatus,
    deleteProductService,
  } = useMasterData();
  const { state } = useAccounting();

  const [search, setSearch] = useState('');
  const [type, setType] = useState<ItemTypeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortFilter>('usage_desc');
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const rows = useMemo(() => {
    const usageByItemName = new Map<string, number>();
    [...state.quotes.flatMap((quote) => quote.items), ...state.invoices.flatMap((invoice) => invoice.items)].forEach(
      (line) => {
        const key = line.itemName.trim().toLowerCase();
        if (!key) return;
        usageByItemName.set(key, (usageByItemName.get(key) ?? 0) + 1);
      },
    );

    const mapped: ListRow[] = productsServices
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        type: entry.type,
        purchaseDescription: entry.purchaseDescription,
        purchaseRate: entry.purchaseRate,
        salesDescription: entry.salesDescription,
        salesRate: entry.salesRate,
        usageUnit: entry.usageUnit || 'each',
        status: entry.status,
        usageCount: usageByItemName.get(entry.name.trim().toLowerCase()) ?? 0,
      }))
      .filter((entry) => {
        const typeMatch = type === 'all' || entry.type === type;
        const statusMatch = status === 'all' || entry.status === status;
        const searchMatch = matchesSearchText(search, [
          entry.name,
          entry.salesDescription,
          entry.purchaseDescription,
          entry.usageUnit,
        ]);
        return typeMatch && statusMatch && searchMatch;
      });

    mapped.sort((a, b) => {
      if (sort === 'name_asc') return a.name.localeCompare(b.name);
      if (sort === 'sales_desc') return b.salesRate - a.salesRate;
      if (sort === 'purchase_desc') return b.purchaseRate - a.purchaseRate;
      return b.usageCount - a.usageCount;
    });

    return mapped;
  }, [productsServices, search, sort, state.invoices, state.quotes, status, type]);

  const downloadCsv = () => {
    const headers = [
      'name',
      'type',
      'usage_unit',
      'sales_rate',
      'sales_description',
      'purchase_rate',
      'purchase_description',
      'status',
    ];
    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        [
          row.name,
          row.type,
          row.usageUnit,
          row.salesRate.toFixed(2),
          (row.salesDescription ?? '').replaceAll('"', '""'),
          row.purchaseRate.toFixed(2),
          (row.purchaseDescription ?? '').replaceAll('"', '""'),
          row.status,
        ]
          .map((cell) => `"${cell}"`)
          .join(','),
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `develogic-items-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
    setNotice({ tone: 'success', text: 'Items export downloaded.' });
  };

  const handleImportSelected = (file?: File) => {
    if (!file) return;
    setNotice({
      tone: 'info',
      text: `Import parser will be enabled in the next pass. Selected file: ${file.name}`,
    });
  };

  const handleClone = async (itemId: string) => {
    setBusyItemId(itemId);
    const result = await cloneProductService(itemId);
    setBusyItemId(null);
    if (!result.ok || !result.data) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to clone item.' });
      return;
    }
    setNotice({ tone: 'success', text: `Item cloned as "${result.data.name}".` });
  };

  const handleToggleStatus = async (itemId: string, currentStatus: 'active' | 'inactive') => {
    const target = currentStatus === 'active' ? 'inactive' : 'active';
    setBusyItemId(itemId);
    const result = await setProductServiceStatus(itemId, target);
    setBusyItemId(null);
    if (!result.ok || !result.data) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to update item status.' });
      return;
    }
    setNotice({
      tone: 'success',
      text: `${result.data.name} marked ${target}.`,
    });
  };

  const handleDelete = async (itemId: string, itemName: string) => {
    const confirmed = window.confirm(
      `Delete item "${itemName}"? This will soft-delete it from active catalogs.`,
    );
    if (!confirmed) return;
    setBusyItemId(itemId);
    const result = await deleteProductService(itemId);
    setBusyItemId(null);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to delete item.' });
      return;
    }
    setNotice({ tone: 'success', text: `Item "${itemName}" deleted.` });
  };

  const handleRefresh = async () => {
    const reloaded = await refresh();
    if (!reloaded) {
      setNotice({ tone: 'error', text: 'Unable to refresh items.' });
      return;
    }
    setNotice({ tone: 'success', text: 'Items refreshed.' });
  };

  return (
    <>
      <PageHeader
        title="Items"
        subtitle="Accounting-aware catalog of goods and services used in sales and purchases."
        actions={
          <>
            <Link to="/items/new">
              <Button variant="primary">New Item</Button>
            </Link>
            <ListUtilityMenu
              sort={sort}
              onSortChange={setSort}
              onImportClick={() => fileInputRef.current?.click()}
              onExportClick={downloadCsv}
              onRefreshClick={() => void handleRefresh()}
              onTogglePreferences={() =>
                setShowDescriptions((previous) => {
                  const next = !previous;
                  setNotice({
                    tone: 'info',
                    text: next
                      ? 'List preferences updated: descriptions visible.'
                      : 'List preferences updated: descriptions hidden.',
                  });
                  return next;
                })
              }
              onResetColumns={() =>
                setNotice({
                  tone: 'info',
                  text: 'Column layout reset to default.',
                })
              }
            />
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(event) => {
          handleImportSelected(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {warning ? <InlineNotice tone="warning">{warning}</InlineNotice> : null}
      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <FilterBar ariaLabel="Item catalog filters">
        <Input
          aria-label="Search items"
          placeholder="Search by item name or description"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(360px, 100%)' }}
        />
        <Select
          aria-label="Item type filter"
          value={type}
          onChange={(event) => setType(event.target.value as ItemTypeFilter)}
          options={[
            { label: 'All Types', value: 'all' },
            { label: 'Goods', value: 'goods' },
            { label: 'Services', value: 'service' },
          ]}
          style={{ width: 170 }}
        />
        <Select
          aria-label="Item status filter"
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          options={[
            { label: 'All Statuses', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ]}
          style={{ width: 170 }}
        />
        <Select
          aria-label="Sort items"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortFilter)}
          options={[
            { label: 'Sort: Most Used', value: 'usage_desc' },
            { label: 'Sort: Name A-Z', value: 'name_asc' },
            { label: 'Sort: Sales Rate High', value: 'sales_desc' },
            { label: 'Sort: Purchase Rate High', value: 'purchase_desc' },
          ]}
          style={{ width: 220 }}
        />
      </FilterBar>

      {loading ? (
        <div className="dl-card" style={{ display: 'grid', gap: 10 }}>
          <Skeleton height={18} />
          <Skeleton height={18} />
          <Skeleton height={18} />
          <Skeleton height={18} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No items yet"
          description="Create goods or services to speed up quote and invoice line-item entry."
          action={
            <Link to="/items/new">
              <Button variant="primary">Create Item</Button>
            </Link>
          }
        />
      ) : (
        <>
          <ResponsiveList
            headers={[
              'Item Name',
              'Purchase Description',
              'Purchase Rate',
              'Sales Description',
              'Sales Rate',
              'Usage Unit',
              'Status',
              'Actions',
            ]}
            desktopRows={
              <>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <div className="dl-muted" style={{ fontSize: 12 }}>
                        {row.type === 'goods' ? 'Goods' : 'Service'} · Used {row.usageCount} times
                      </div>
                    </td>
                    <td>{showDescriptions ? row.purchaseDescription || '—' : 'Hidden by preference'}</td>
                    <td>{formatCurrency(row.purchaseRate)}</td>
                    <td>{showDescriptions ? row.salesDescription || '—' : 'Hidden by preference'}</td>
                    <td>{formatCurrency(row.salesRate)}</td>
                    <td>{row.usageUnit || 'each'}</td>
                    <td>
                      <Badge variant={row.status === 'active' ? 'success' : 'neutral'}>
                        {row.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <RowActionsMenu
                        itemId={row.id}
                        itemName={row.name}
                        status={row.status}
                        busy={busyItemId === row.id}
                        onClone={handleClone}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                      />
                    </td>
                  </tr>
                ))}
              </>
            }
            mobileCards={
              <>
                {rows.map((row) => (
                  <article key={row.id} className="dl-mobile-item">
                    <div className="dl-mobile-item-header">
                      <div>
                        <strong>{row.name}</strong>
                        <div className="dl-muted" style={{ fontSize: 12 }}>
                          {row.type === 'goods' ? 'Goods' : 'Service'}
                        </div>
                      </div>
                      <Badge variant={row.status === 'active' ? 'success' : 'neutral'}>
                        {row.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="dl-mobile-meta">
                      <div>
                        <span>Sales Rate</span>
                        <div>{formatCurrency(row.salesRate)}</div>
                      </div>
                      <div>
                        <span>Purchase Rate</span>
                        <div>{formatCurrency(row.purchaseRate)}</div>
                      </div>
                      <div>
                        <span>Usage Unit</span>
                        <div>{row.usageUnit || 'each'}</div>
                      </div>
                      <div>
                        <span>Usage</span>
                        <div>{row.usageCount}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Link to={`/items/${row.id}`}>Open item</Link>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <RowActionsMenu
                        itemId={row.id}
                        itemName={row.name}
                        status={row.status}
                        busy={busyItemId === row.id}
                        onClone={handleClone}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                      />
                    </div>
                  </article>
                ))}
              </>
            }
          />
          <div className="dl-list-footer">
            Showing {rows.length} items · Total listed value {formatMinorCurrency(
              rows.reduce((sum, row) => sum + Math.round(row.salesRate * 100), 0),
            )}
          </div>
        </>
      )}
    </>
  );
}

interface ListUtilityMenuProps {
  sort: SortFilter;
  onSortChange: (value: SortFilter) => void;
  onImportClick: () => void;
  onExportClick: () => void;
  onRefreshClick: () => void;
  onTogglePreferences: () => void;
  onResetColumns: () => void;
}

function ListUtilityMenu(props: ListUtilityMenuProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updatePopoverPosition = () => {
    if (!rootRef.current) return;
    const triggerRect = rootRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const estimatedMenuHeight = 258;
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

  const closeAndRun = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="dl-row-action-menu" ref={rootRef}>
      <IconButton
        icon="⋯"
        label="Item list actions"
        className="dl-row-action-trigger"
        onClick={() => setOpen((previous) => !previous)}
      />
      {open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-row-action-popover"
              role="menu"
              aria-label="Item list actions"
              style={popoverStyle}
            >
              <button
                type="button"
                className="dl-row-action-item"
                onClick={() => closeAndRun(() => props.onSortChange('name_asc'))}
              >
                Sort by Name
              </button>
              <button
                type="button"
                className="dl-row-action-item"
                onClick={() => closeAndRun(() => props.onSortChange('sales_desc'))}
              >
                Sort by Sales Rate
              </button>
              <button
                type="button"
                className="dl-row-action-item"
                onClick={() => closeAndRun(() => props.onImportClick())}
              >
                Import Items
              </button>
              <button
                type="button"
                className="dl-row-action-item"
                onClick={() => closeAndRun(() => props.onExportClick())}
              >
                Export Items
              </button>
              <button
                type="button"
                className="dl-row-action-item"
                onClick={() => closeAndRun(() => props.onTogglePreferences())}
              >
                Preferences
              </button>
              <button
                type="button"
                className="dl-row-action-item"
                onClick={() => closeAndRun(() => props.onRefreshClick())}
              >
                Refresh List
              </button>
              <button
                type="button"
                className="dl-row-action-item"
                onClick={() => closeAndRun(() => props.onResetColumns())}
              >
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

interface RowActionsMenuProps {
  itemId: string;
  itemName: string;
  status: 'active' | 'inactive';
  busy: boolean;
  onClone: (itemId: string) => Promise<void>;
  onToggleStatus: (itemId: string, currentStatus: 'active' | 'inactive') => Promise<void>;
  onDelete: (itemId: string, itemName: string) => Promise<void>;
}

function RowActionsMenu({
  itemId,
  itemName,
  status,
  busy,
  onClone,
  onToggleStatus,
  onDelete,
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updatePopoverPosition = () => {
    if (!rootRef.current) return;

    const triggerRect = rootRef.current.getBoundingClientRect();
    const menuWidth = 190;
    const estimatedMenuHeight = 178;
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

  const closeAndRun = (fn: () => Promise<void>) => {
    setOpen(false);
    void fn();
  };

  return (
    <div className="dl-row-action-menu" ref={rootRef}>
      <IconButton
        icon="⋯"
        label="Item actions"
        className="dl-row-action-trigger"
        onClick={() => setOpen((previous) => !previous)}
      />
      {open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-row-action-popover"
              role="menu"
              aria-label={`Actions for ${itemName}`}
              style={popoverStyle}
            >
              <Link to={`/items/${itemId}`} className="dl-row-action-item" onClick={() => setOpen(false)}>
                Open
              </Link>
              <Link to={`/items/${itemId}/edit`} className="dl-row-action-item" onClick={() => setOpen(false)}>
                Edit
              </Link>
              <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(() => onClone(itemId))} disabled={busy}>
                {busy ? 'Working...' : 'Clone Item'}
              </button>
              <button
                type="button"
                className="dl-row-action-item"
                onClick={() => closeAndRun(() => onToggleStatus(itemId, status))}
                disabled={busy}
              >
                {status === 'active' ? 'Mark as Inactive' : 'Mark as Active'}
              </button>
              <button
                type="button"
                className="dl-row-action-item danger"
                onClick={() => closeAndRun(() => onDelete(itemId, itemName))}
                disabled={busy}
              >
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
