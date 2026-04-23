import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { formatBytes, formatDate } from '@/utils/format';
import { Card } from '@/design-system/primitives/Card';
import { Button } from '@/design-system/primitives/Button';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';
import { PdfArchiveListRow, PdfArchiveRecord, PdfGenerationMode } from '@/modules/pdf/domain/types';
import { matchesDateRange, matchesSearchText } from '@/modules/insights/domain/filters';

function matchesGenerationMode(modeFilter: string, mode: PdfGenerationMode): boolean {
  return modeFilter === 'all' || modeFilter === mode;
}

function toGenerationModeLabel(mode: PdfGenerationMode): string {
  if (mode === 'draft_preview') return 'Draft Preview';
  if (mode === 'historical_archive') return 'Historical Archive';
  return 'Manual Regeneration';
}

function documentPathFromRecord(record: PdfArchiveRecord): string {
  if (record.documentReference.documentType === 'quote') {
    return `/quotes/${record.documentReference.documentId}`;
  }
  return `/invoices/${record.documentReference.documentId}`;
}

export function PdfArchivePage() {
  const { rows, getRecordById, openPdfRecord, downloadPdfRecord } = usePdfArchive();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [mode, setMode] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<'generated_desc' | 'generated_asc'>('generated_desc');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobileViewport(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const filtered = useMemo(
    () => {
      const filteredRows = rows.filter((entry) => {
        const typeMatch = type === 'all' || entry.documentType === type;
        const modeMatch = matchesGenerationMode(mode, entry.generationMode);
        const dateMatch = matchesDateRange(entry.generatedAt, dateFrom || undefined, dateTo || undefined);
        const searchMatch = matchesSearchText(search, [
          entry.documentNumber,
          entry.clientName,
          entry.templateName,
          entry.fileName,
          entry.checksum,
        ]);
        return typeMatch && modeMatch && dateMatch && searchMatch;
      });

      filteredRows.sort((a, b) => {
        if (sort === 'generated_asc') return a.generatedAt.localeCompare(b.generatedAt);
        return b.generatedAt.localeCompare(a.generatedAt);
      });

      return filteredRows;
    },
    [dateFrom, dateTo, mode, rows, search, sort, type],
  );

  useEffect(() => {
    if (selectedId && !filtered.some((entry) => entry.id === selectedId)) {
      setSelectedId(undefined);
    }
  }, [filtered, selectedId]);

  const selectedRow = selectedId ? filtered.find((entry) => entry.id === selectedId) : undefined;
  const selectedRecord = selectedId ? getRecordById(selectedId) : undefined;

  const handleOpen = (recordId: string) => {
    const result = openPdfRecord(recordId);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to open PDF.' });
      return;
    }

    setNotice(null);
  };

  const handleDownload = (recordId: string) => {
    const result = downloadPdfRecord(recordId);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? 'PDF download started.' : result.error ?? 'Unable to download PDF.',
    });
  };

  return (
    <>
      <PageHeader
        title="PDF Archive"
        subtitle="Immutable and draft PDF generations tied to template version context."
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <FilterBar ariaLabel="PDF archive filters">
        <Input
          aria-label="Search PDF archive"
          placeholder="Search document number, client, template, checksum"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(420px, 100%)' }}
        />
        <Select
          aria-label="Document type filter"
          value={type}
          onChange={(event) => setType(event.target.value)}
          options={[
            { label: 'All document types', value: 'all' },
            { label: 'Quotes', value: 'quote' },
            { label: 'Invoices', value: 'invoice' },
          ]}
          style={{ width: 180 }}
        />
        <Select
          aria-label="Sort archive records"
          value={sort}
          onChange={(event) => setSort(event.target.value as 'generated_desc' | 'generated_asc')}
          options={[
            { label: 'Sort: Newest', value: 'generated_desc' },
            { label: 'Sort: Oldest', value: 'generated_asc' },
          ]}
          style={{ width: 180 }}
        />
        <Input
          aria-label="Generation date from"
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          style={{ width: 170 }}
        />
        <Input
          aria-label="Generation date to"
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          style={{ width: 170 }}
        />
        <Select
          aria-label="Generation mode filter"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          options={[
            { label: 'All generation modes', value: 'all' },
            { label: 'Draft previews', value: 'draft_preview' },
            { label: 'Historical archives', value: 'historical_archive' },
            { label: 'Manual regenerations', value: 'manual_regeneration' },
          ]}
          style={{ width: 220 }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No archived PDFs yet"
          description="Generate PDFs from quote or invoice screens to populate archive history."
        />
      ) : (
        <div className="dl-page-stack">
          <ResponsiveList
            headers={['Type', 'Document #', 'Client', 'Mode', 'Generated', 'Actions']}
            desktopRows={
              <>
                {filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.documentType === 'quote' ? 'Quote' : 'Invoice'}</td>
                    <td>{entry.documentNumber}</td>
                    <td>{entry.clientName}</td>
                    <td>
                      <span className={`dl-badge ${entry.immutable ? 'success' : 'info'}`}>
                        {toGenerationModeLabel(entry.generationMode)}
                      </span>
                    </td>
                    <td>{formatDate(entry.generatedAt)}</td>
                    <td>
                      <div className="dl-inline-actions">
                        <Button size="sm" onClick={() => setSelectedId(entry.id)}>
                          Preview
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => handleOpen(entry.id)}>
                          Open
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDownload(entry.id)}>
                          Download
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
                      <span className={`dl-badge ${entry.immutable ? 'success' : 'info'}`}>
                        {entry.immutable ? 'Immutable' : 'Draft'}
                      </span>
                    </div>
                    <div>{entry.clientName}</div>
                    <div className="dl-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {toGenerationModeLabel(entry.generationMode)} · {formatDate(entry.generatedAt)}
                    </div>
                    <div className="dl-inline-actions" style={{ marginTop: 10 }}>
                      <Button size="sm" onClick={() => setSelectedId(entry.id)}>
                        Preview
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleOpen(entry.id)}>
                        Open
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(entry.id)}>
                        Download
                      </Button>
                    </div>
                  </article>
                ))}
              </>
            }
          />

          {selectedRecord && selectedRow ? (
            <Card
              title="Archive Preview"
              subtitle="Selected PDF snapshot and metadata"
              action={
                <Button size="sm" variant="ghost" onClick={() => setSelectedId(undefined)}>
                  Close Preview
                </Button>
              }
            >
              <div style={{ display: 'grid', gap: 10 }}>
                {isMobileViewport ? (
                  <div className="dl-preview-pane dl-mobile-preview-fallback" style={{ minHeight: 180, padding: 14 }}>
                    <div style={{ display: 'grid', gap: 8, textAlign: 'center' }}>
                      <strong>Inline PDF preview is limited on mobile browsers.</strong>
                      <span>Use Open PDF or Download PDF to view this archive file.</span>
                    </div>
                  </div>
                ) : (
                  <div className="dl-preview-pane" style={{ minHeight: 260, padding: 10 }}>
                    <iframe
                      title={`PDF preview ${selectedRow.documentNumber}`}
                      src={selectedRecord.file.dataUrl}
                      style={{ width: '100%', height: 320, border: 0, borderRadius: 8, background: '#ffffff' }}
                    />
                  </div>
                )}
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  <div>
                    <strong>Document:</strong> {selectedRow.documentNumber}
                  </div>
                  <div>
                    <strong>Client:</strong> {selectedRow.clientName}
                  </div>
                  <div>
                    <strong>Template:</strong> {selectedRow.templateName} v{selectedRow.templateVersionNumber}
                  </div>
                  <div>
                    <strong>Archive Revision:</strong> v{selectedRow.revision}
                  </div>
                  <div>
                    <strong>Generated:</strong> {formatDate(selectedRow.generatedAt)}
                  </div>
                  <div>
                    <strong>Mode:</strong> {toGenerationModeLabel(selectedRow.generationMode)}
                  </div>
                  <div>
                    <strong>Immutable:</strong> {selectedRow.immutable ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <strong>File:</strong> {selectedRow.fileName} ({formatBytes(selectedRow.sizeBytes)})
                  </div>
                  <div>
                    <strong>Checksum:</strong>{' '}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedRow.checksum}</span>
                  </div>
                </div>
                <div className="dl-inline-actions">
                  <Link to={documentPathFromRecord(selectedRecord)}>
                    <Button size="sm" variant="secondary">
                      Open Source Document
                    </Button>
                  </Link>
                  <Button size="sm" onClick={() => handleOpen(selectedRecord.id)}>
                    Open PDF
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(selectedRecord.id)}>
                    Download PDF
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
