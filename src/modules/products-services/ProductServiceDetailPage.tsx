import { CSSProperties, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { Tabs } from '@/design-system/primitives/Tabs';
import { Select } from '@/design-system/primitives/Select';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { IconButton } from '@/design-system/primitives/IconButton';
import { Badge } from '@/design-system/primitives/Badge';
import { formatCurrency, formatDate, formatMinorCurrency } from '@/utils/format';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { summarizeProductHistoryEvent } from './domain/history';
import { buildItemTransactions, ItemTransactionKind } from './domain/transactions';

type ItemWorkspaceTab = 'overview' | 'transactions' | 'history';

const ITEM_TABS: Array<{ key: ItemWorkspaceTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'history', label: 'History' },
];

export function ProductServiceDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const {
    clients,
    getProductById,
    cloneProductService,
    setProductServiceStatus,
    deleteProductService,
    getProductHistory,
    loadProductHistory,
  } = useMasterData();
  const { state } = useAccounting();
  const item = getProductById(productId);

  const [activeTab, setActiveTab] = useState<ItemWorkspaceTab>('overview');
  const [txFilter, setTxFilter] = useState<'all' | ItemTransactionKind>('all');
  const [busyAction, setBusyAction] = useState<'clone' | 'status' | 'delete' | null>(null);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);

  useEffect(() => {
    if (!item?.id) return;
    void loadProductHistory(item.id);
  }, [item?.id, loadProductHistory]);

  if (!item) {
    return (
      <EmptyState
        title="Item not found"
        description="The requested item does not exist or has been deleted."
        action={
          <Link to="/items">
            <Button variant="primary">Back to Items</Button>
          </Link>
        }
      />
    );
  }

  const transactions = buildItemTransactions({
    item,
    accounting: state,
    clients,
  });
  const filteredTransactions =
    txFilter === 'all'
      ? transactions
      : transactions.filter((row) => row.kind === txFilter);

  const history = getProductHistory(item.id);

  const handleClone = async () => {
    setNotice(null);
    setBusyAction('clone');
    const result = await cloneProductService(item.id);
    setBusyAction(null);
    if (!result.ok || !result.data) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to clone item.' });
      return;
    }
    setNotice({ tone: 'success', text: `Item cloned as "${result.data.name}".` });
    navigate(`/items/${result.data.id}/edit`);
  };

  const handleToggleStatus = async () => {
    setNotice(null);
    setBusyAction('status');
    const target = item.status === 'active' ? 'inactive' : 'active';
    const result = await setProductServiceStatus(item.id, target);
    setBusyAction(null);
    if (!result.ok || !result.data) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to update item status.' });
      return;
    }
    setNotice({ tone: 'success', text: `${result.data.name} marked ${target}.` });
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete item "${item.name}"? This will soft-delete the item from active catalogs.`,
    );
    if (!confirmed) return;
    setNotice(null);
    setBusyAction('delete');
    const result = await deleteProductService(item.id);
    setBusyAction(null);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to delete item.' });
      return;
    }
    navigate('/items');
  };

  return (
    <>
      <PageHeader
        title={item.name}
        subtitle={`${item.type === 'goods' ? 'Goods' : 'Service'} · ${item.usageUnit} · ${item.status}`}
        actions={
          <>
            <Link to={`/items/${item.id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
            <DetailActionsMenu
              itemName={item.name}
              busy={busyAction !== null}
              status={item.status}
              onClone={() => void handleClone()}
              onToggleStatus={() => void handleToggleStatus()}
              onDelete={() => void handleDelete()}
            />
          </>
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <div style={{ marginBottom: 12 }}>
        <Tabs tabs={ITEM_TABS} activeKey={activeTab} onChange={(key) => setActiveTab(key as ItemWorkspaceTab)} />
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="dl-grid cols-4">
            <Card title="Sales Rate">
              <p className="dl-stat-value">{formatCurrency(item.salesRate)}</p>
            </Card>
            <Card title="Purchase Rate">
              <p className="dl-stat-value">{formatCurrency(item.purchaseRate)}</p>
            </Card>
            <Card title="Usage Count">
              <p className="dl-stat-value">{transactions.length}</p>
            </Card>
            <Card title="Status">
              <Badge variant={item.status === 'active' ? 'success' : 'neutral'}>
                {item.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </Card>
          </div>

          <div className="dl-grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Item Profile">
              <div className="dl-meta-grid">
                <div><strong>Type:</strong> {item.type === 'goods' ? 'Goods' : 'Service'}</div>
                <div><strong>Usage Unit:</strong> {item.usageUnit || 'each'}</div>
                <div><strong>Capital Asset:</strong> {item.isCapitalAsset ? 'Yes' : 'No'}</div>
                <div><strong>SKU:</strong> {item.sku ?? '—'}</div>
                <div><strong>Created Source:</strong> {item.createdSource ?? 'manual'}</div>
                <div><strong>Preferred Vendor:</strong> {item.preferredVendorName ?? 'Not assigned'}</div>
                <div><strong>Reporting Tags:</strong> {item.reportingTags.length > 0 ? item.reportingTags.join(', ') : 'None'}</div>
              </div>
            </Card>

            <Card title="Visual">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={`${item.name} preview`}
                  style={{
                    width: 180,
                    maxWidth: '100%',
                    height: 180,
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: '1px solid var(--border-default)',
                  }}
                />
              ) : (
                <p className="dl-muted">No image uploaded.</p>
              )}
            </Card>
          </div>

          <div className="dl-grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Purchase Information">
              <div className="dl-meta-grid">
                <div><strong>Cost Price:</strong> {formatCurrency(item.purchaseRate)}</div>
                <div><strong>Purchase Account:</strong> {item.purchaseAccountId ?? 'Unassigned'}</div>
                <div><strong>Description:</strong> {item.purchaseDescription ?? 'No purchase description.'}</div>
              </div>
            </Card>

            <Card title="Sales Information">
              <div className="dl-meta-grid">
                <div><strong>Selling Price:</strong> {formatCurrency(item.salesRate)}</div>
                <div><strong>Sales Account:</strong> {item.salesAccountId ?? 'Unassigned'}</div>
                <div><strong>Description:</strong> {item.salesDescription ?? 'No sales description.'}</div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {activeTab === 'transactions' ? (
        <Card title="Item Transactions" subtitle="Quotes and invoices referencing this item">
          <div className="dl-filter-bar">
            <Select
              aria-label="Transaction kind filter"
              value={txFilter}
              onChange={(event) => setTxFilter(event.target.value as 'all' | ItemTransactionKind)}
              options={[
                { label: 'All Transactions', value: 'all' },
                { label: 'Quotes', value: 'quote' },
                { label: 'Invoices', value: 'invoice' },
              ]}
              style={{ width: 220 }}
            />
          </div>

          {filteredTransactions.length === 0 ? (
            <EmptyState
              title="No transactions found"
              description="This item has not been used in matching documents yet."
            />
          ) : (
            <div className="dl-table-wrap">
              <table className="dl-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Document</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Line Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.date)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{row.kind}</td>
                      <td>{row.documentNumber}</td>
                      <td>{row.clientName}</td>
                      <td>{row.status}</td>
                      <td>{row.quantity}</td>
                      <td>{formatMinorCurrency(row.unitPriceMinor)}</td>
                      <td>{formatMinorCurrency(row.lineTotalMinor)}</td>
                      <td>
                        <Link to={row.route}>Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === 'history' ? (
        <Card title="Item History" subtitle="Audit trail for item updates and status changes">
          {history.length === 0 ? (
            <div className="dl-timeline">
              <article className="dl-timeline-item">
                <h3 className="dl-timeline-title">Item created</h3>
                <p className="dl-timeline-meta">{formatDate(item.createdAt)}</p>
              </article>
              <article className="dl-timeline-item">
                <h3 className="dl-timeline-title">Item updated</h3>
                <p className="dl-timeline-meta">{formatDate(item.updatedAt)}</p>
              </article>
            </div>
          ) : (
            <div className="dl-timeline">
              {history.map((event) => {
                const summary = summarizeProductHistoryEvent(event);
                return (
                  <article key={event.id} className="dl-timeline-item">
                    <h3 className="dl-timeline-title">{summary.title}</h3>
                    <p className="dl-timeline-meta">
                      {formatDate(event.createdAt)}
                      {event.actorUserId ? ` · ${event.actorUserId}` : ''}
                    </p>
                    {summary.detail ? <p style={{ marginTop: 6 }}>{summary.detail}</p> : null}
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}
    </>
  );
}

interface DetailActionsMenuProps {
  itemName: string;
  status: 'active' | 'inactive';
  busy: boolean;
  onClone: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

function DetailActionsMenu({
  itemName,
  status,
  busy,
  onClone,
  onToggleStatus,
  onDelete,
}: DetailActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updatePopoverPosition = () => {
    if (!rootRef.current) return;

    const triggerRect = rootRef.current.getBoundingClientRect();
    const menuWidth = 196;
    const estimatedMenuHeight = 148;
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
        label={`More actions for ${itemName}`}
        className="dl-row-action-trigger"
        onClick={() => setOpen((previous) => !previous)}
      />
      {open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-row-action-popover"
              role="menu"
              aria-label={`More actions for ${itemName}`}
              style={popoverStyle}
            >
              <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(onClone)} disabled={busy}>
                {busy ? 'Working...' : 'Clone Item'}
              </button>
              <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(onToggleStatus)} disabled={busy}>
                {status === 'active' ? 'Mark as Inactive' : 'Mark as Active'}
              </button>
              <button type="button" className="dl-row-action-item danger" onClick={() => closeAndRun(onDelete)} disabled={busy}>
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
