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
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';
import { PdfArchiveListRow, PdfArchiveRecord, PdfGenerationMode } from '@/modules/pdf/domain/types';

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
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter((entry) => {
        const typeMatch = type === 'all' || entry.documentType === type;
        const modeMatch = matchesGenerationMode(mode, entry.generationMode);
        const searchMatch =
          search.trim().length === 0 ||
          [
            entry.documentNumber,
            entry.clientName,
            entry.templateName,
            entry.fileName,
            entry.checksum,
          ].some((field) => field.toLowerCase().includes(search.toLowerCase()));
        return typeMatch && modeMatch && searchMatch;
      }),
    [mode, rows, search, type],
  );

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(undefined);
      return;
    }

    if (!selectedId || !filtered.some((entry) => entry.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selectedRow = selectedId ? filtered.find((entry) => entry.id === selectedId) : undefined;
  const selectedRecord = selectedId ? getRecordById(selectedId) : undefined;

  const handleOpen = (recordId: string) => {
    const result = openPdfRecord(recordId);
    if (!result.ok) {
      setMessage(result.error ?? 'Unable to open PDF.');
      return;
    }

    setMessage(null);
  };

  const handleDownload = (recordId: string) => {
    const result = downloadPdfRecord(recordId);
    setMessage(result.ok ? 'PDF download started.' : result.error ?? 'Unable to download PDF.');
  };

  return (
    <>
      <PageHeader
        title="PDF Archive"
        subtitle="Immutable and draft PDF generations tied to template version context."
      />

      {message ? <div className="dl-validation-inline" style={{ marginBottom: 12 }}>{message}</div> : null}

      <FilterBar>
        <Input
          placeholder="Search document number, client, template, checksum"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(420px, 100%)' }}
        />
        <Select
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
        <div className="dl-grid cols-2">
          <div>
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
          </div>

          <Card title="Archive Preview" subtitle="Selected PDF snapshot and metadata">
            {selectedRecord && selectedRow ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div className="dl-preview-pane" style={{ minHeight: 260, padding: 10 }}>
                  <iframe
                    title={`PDF preview ${selectedRow.documentNumber}`}
                    src={selectedRecord.file.dataUrl}
                    style={{ width: '100%', height: 320, border: 0, borderRadius: 8, background: '#ffffff' }}
                  />
                </div>
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
            ) : (
              <p className="dl-muted" style={{ margin: 0 }}>
                Select an archive record to inspect preview metadata.
              </p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
