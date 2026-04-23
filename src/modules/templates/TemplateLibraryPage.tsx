import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { TemplateStatusBadge } from '@/design-system/patterns/StatusBadge';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { formatDate } from '@/utils/format';
import { TemplatePreviewRenderer } from './components/TemplatePreviewRenderer';
import { createInvoiceTemplatePreviewPayload, createQuoteTemplatePreviewPayload } from './domain/sample-preview';
import { useTemplates } from './hooks/useTemplates';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { IconButton } from '@/design-system/primitives/IconButton';

export function TemplateLibraryPage() {
  const {
    templateRows,
    getTemplateSnapshot,
    duplicateTemplate,
    publishTemplate,
    archiveTemplate,
    setDefaultTemplate,
  } = useTemplates();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);

  const filteredRows = useMemo(
    () =>
      templateRows.filter((row) => {
        const typeMatch = typeFilter === 'all' || row.type === typeFilter;
        const statusMatch = statusFilter === 'all' || row.status === statusFilter;
        const searchMatch =
          search.trim().length === 0 ||
          [row.name, row.description, row.type].some((value) =>
            value.toLowerCase().includes(search.toLowerCase()),
          );
        return typeMatch && statusMatch && searchMatch;
      }),
    [search, statusFilter, templateRows, typeFilter],
  );

  const publishedCount = templateRows.filter((row) => row.status === 'published').length;
  const defaultsCount = templateRows.filter((row) => row.isDefaultForInvoice || row.isDefaultForQuote).length;

  return (
    <section className="dl-template-library-page">
      <PageHeader
        title="Template Library"
        subtitle={`Published templates: ${publishedCount} · Defaults assigned: ${defaultsCount}`}
        actions={
          <Link to="/templates/new/editor">
            <Button variant="primary">Create Template</Button>
          </Link>
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <FilterBar ariaLabel="Template filters">
        <Input
          aria-label="Search templates"
          placeholder="Search templates"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(340px, 100%)' }}
        />
        <Select
          aria-label="Template type filter"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          options={[
            { label: 'All types', value: 'all' },
            { label: 'Quote', value: 'quote' },
            { label: 'Invoice', value: 'invoice' },
            { label: 'Universal', value: 'universal' },
          ]}
          style={{ width: 160 }}
        />
        <Select
          aria-label="Template status filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={[
            { label: 'All statuses', value: 'all' },
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
            { label: 'Archived', value: 'archived' },
          ]}
          style={{ width: 160 }}
        />
      </FilterBar>

      {filteredRows.length === 0 ? (
        <EmptyState
          title="No templates found"
          description="Adjust your filters or create a new template to get started."
          action={
            <Link to="/templates/new/editor">
              <Button variant="primary">Create Template</Button>
            </Link>
          }
        />
      ) : (
        <div className="dl-template-library-grid">
          {filteredRows.map((row) => {
            const snapshot = getTemplateSnapshot(row.id);
            const previewConfig = snapshot?.editableVersion?.config ?? snapshot?.publishedVersion?.config;
            const previewPayload =
              row.type === 'invoice' ? createInvoiceTemplatePreviewPayload() : createQuoteTemplatePreviewPayload();

            return (
              <Card
                key={row.id}
                title={row.name}
                subtitle={`${prettyType(row.type)} template`}
                rightSlot={<TemplateStatusBadge status={row.status} />}
              >
                <div className="dl-template-card-preview">
                  {previewConfig ? (
                    <TemplatePreviewRenderer config={previewConfig} payload={previewPayload} />
                  ) : (
                    <div className="dl-preview-pane" style={{ minHeight: 190 }}>
                      No preview available
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  <div>{row.description || 'No description provided.'}</div>
                  <div className="dl-muted">
                    Published version: {row.publishedVersionNumber ? `v${row.publishedVersionNumber}` : 'None'}
                  </div>
                  <div className="dl-muted">
                    Draft version: {row.draftVersionNumber ? `v${row.draftVersionNumber}` : 'None'}
                  </div>
                  <div className="dl-muted">Updated {formatDate(row.updatedAt)}</div>
                  <div className="dl-inline-actions">
                    {row.isDefaultForQuote ? <span className="dl-badge info">Default Quote</span> : null}
                    {row.isDefaultForInvoice ? <span className="dl-badge info">Default Invoice</span> : null}
                  </div>
                </div>

                <div className="dl-inline-actions" style={{ marginTop: 12 }}>
                  <Link to={`/templates/${row.id}/editor?preview=1`}>
                    <Button size="sm" variant="secondary">Preview</Button>
                  </Link>
                  <Link to={`/templates/${row.id}/editor`}>
                    <Button size="sm" variant="primary">Edit</Button>
                  </Link>
                  <TemplateCardActionsMenu
                    templateId={row.id}
                    templateName={row.name}
                    canPublish={row.status !== 'published'}
                    canArchive={row.status === 'published'}
                    canSetDefaultQuote={
                      (row.type === 'quote' || row.type === 'universal') && row.status === 'published'
                    }
                    canSetDefaultInvoice={
                      (row.type === 'invoice' || row.type === 'universal') && row.status === 'published'
                    }
                    onDuplicate={() => {
                      const result = duplicateTemplate(row.id);
                      setNotice({
                        tone: result.ok ? 'success' : 'error',
                        text: result.ok ? 'Template duplicated.' : result.error ?? 'Unable to duplicate template.',
                      });
                    }}
                    onPublish={() => {
                      const result = publishTemplate(row.id, 'Published from template library');
                      setNotice({
                        tone: result.ok ? 'success' : 'error',
                        text: result.ok ? 'Template published.' : result.error ?? 'Unable to publish template.',
                      });
                    }}
                    onArchive={() => {
                      const result = archiveTemplate(row.id);
                      setNotice({
                        tone: result.ok ? 'success' : 'error',
                        text: result.ok ? 'Template archived.' : result.error ?? 'Unable to archive template.',
                      });
                    }}
                    onSetDefaultQuote={() => {
                      const result = setDefaultTemplate(row.id, 'quote');
                      setNotice({
                        tone: result.ok ? 'success' : 'error',
                        text: result.ok ? 'Default quote template updated.' : result.error ?? 'Unable to set default.',
                      });
                    }}
                    onSetDefaultInvoice={() => {
                      const result = setDefaultTemplate(row.id, 'invoice');
                      setNotice({
                        tone: result.ok ? 'success' : 'error',
                        text: result.ok
                          ? 'Default invoice template updated.'
                          : result.error ?? 'Unable to set default.',
                      });
                    }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

function prettyType(type: 'quote' | 'invoice' | 'universal'): string {
  return type.replace(/\b\w/g, (match) => match.toUpperCase());
}

interface TemplateCardActionsMenuProps {
  templateId: string;
  templateName: string;
  canPublish: boolean;
  canArchive: boolean;
  canSetDefaultQuote: boolean;
  canSetDefaultInvoice: boolean;
  onDuplicate: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onSetDefaultQuote: () => void;
  onSetDefaultInvoice: () => void;
}

function TemplateCardActionsMenu({
  templateId,
  templateName,
  canPublish,
  canArchive,
  canSetDefaultQuote,
  canSetDefaultInvoice,
  onDuplicate,
  onPublish,
  onArchive,
  onSetDefaultQuote,
  onSetDefaultInvoice,
}: TemplateCardActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updatePopoverPosition = () => {
    if (!rootRef.current) return;
    const triggerRect = rootRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const estimatedMenuHeight = 222;
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
        label={`More actions for ${templateName}`}
        className="dl-row-action-trigger"
        onClick={() => setOpen((previous) => !previous)}
      />
      {open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-row-action-popover"
              role="menu"
              aria-label={`Template actions for ${templateName}`}
              style={popoverStyle}
            >
              <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(onDuplicate)}>
                Duplicate
              </button>
              {canPublish ? (
                <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(onPublish)}>
                  Publish
                </button>
              ) : null}
              {canArchive ? (
                <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(onArchive)}>
                  Archive
                </button>
              ) : null}
              {canSetDefaultQuote ? (
                <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(onSetDefaultQuote)}>
                  Set Default Quote
                </button>
              ) : null}
              {canSetDefaultInvoice ? (
                <button type="button" className="dl-row-action-item" onClick={() => closeAndRun(onSetDefaultInvoice)}>
                  Set Default Invoice
                </button>
              ) : null}
              <Link
                to={`/templates/${templateId}/editor`}
                className="dl-row-action-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                Open Editor
              </Link>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
