import { describe, expect, it } from 'vitest';
import {
  canRegenerateWithoutOverwrite,
  evaluatePdfGenerationPolicy,
  getNextPdfRevision,
  selectLatestPdfRecord,
} from '../rules';
import { PdfArchiveRecord } from '../types';
import { createDefaultTemplateConfigForType } from '@/modules/templates/domain/defaults';

function makeRecord(input: {
  id: string;
  documentType: 'quote' | 'invoice';
  documentId: string;
  revision: number;
  immutable: boolean;
  generatedAt?: string;
}): PdfArchiveRecord {
  const generatedAt = input.generatedAt ?? `2026-04-0${input.revision}T09:00:00.000Z`;
  return {
    id: input.id,
    revision: input.revision,
    status: 'generated',
    generationMode: input.immutable ? 'historical_archive' : 'draft_preview',
    immutable: input.immutable,
    generatedAt,
    source: { source: 'system' },
    documentReference: {
      documentType: input.documentType,
      documentId: input.documentId,
      documentNumber: input.documentType === 'quote' ? 'QUO-00001' : 'INV-00001',
      documentStatus: input.immutable ? 'sent' : 'draft',
    },
    versionContext: {
      templateId: 'tpl_1',
      templateVersionId: 'tplver_1',
      templateName: 'Modern',
      templateVersionNumber: 1,
    },
    snapshot: {
      renderSchemaVersion: 1,
      capturedAt: generatedAt,
      currencyCode: 'ZAR',
      documentReference: {
        documentType: input.documentType,
        documentId: input.documentId,
        documentNumber: input.documentType === 'quote' ? 'QUO-00001' : 'INV-00001',
        documentStatus: input.immutable ? 'sent' : 'draft',
      },
      template: {
        id: 'tpl_1',
        versionId: 'tplver_1',
        name: 'Modern',
        versionNumber: 1,
        config: createDefaultTemplateConfigForType(input.documentType),
      },
      previewPayload: {
        documentType: input.documentType,
        documentTitle: input.documentType === 'quote' ? 'Quote' : 'Invoice',
        documentNumber: input.documentType === 'quote' ? 'QUO-00001' : 'INV-00001',
        issueDate: '2026-04-01',
        dueOrExpiryLabel: 'Due',
        dueOrExpiryDate: '2026-04-30',
        business: { name: 'DeveLogic', addressLines: [] },
        client: { name: 'Client', addressLines: [] },
        lineItems: [],
        totals: {
          subtotalMinor: 0,
          lineDiscountMinor: 0,
          documentDiscountMinor: 0,
          taxMinor: 0,
          totalMinor: 0,
        },
      },
    },
    file: {
      fileName: 'file.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'deadbeef',
      storageKey: 'pdf/example/file.pdf',
      dataUrl: 'data:application/pdf;base64,abc',
    },
  };
}

describe('pdf generation rules', () => {
  it('blocks draft preview generation for non-draft documents', () => {
    const policy = evaluatePdfGenerationPolicy({
      generationMode: 'draft_preview',
      documentStatus: 'sent',
    });
    expect(policy.allowed).toBe(false);
  });

  it('allows historical archive generation for non-draft documents as immutable', () => {
    const policy = evaluatePdfGenerationPolicy({
      generationMode: 'historical_archive',
      documentStatus: 'sent',
    });
    expect(policy.allowed).toBe(true);
    expect(policy.immutable).toBe(true);
  });

  it('increments PDF revision per source document', () => {
    const records = [
      makeRecord({ id: 'pdf_1', documentType: 'quote', documentId: 'q_1', revision: 1, immutable: false }),
      makeRecord({ id: 'pdf_2', documentType: 'quote', documentId: 'q_1', revision: 2, immutable: true }),
      makeRecord({ id: 'pdf_3', documentType: 'invoice', documentId: 'inv_1', revision: 1, immutable: true }),
    ];

    const next = getNextPdfRevision(records, { documentType: 'quote', documentId: 'q_1' });
    expect(next).toBe(3);
  });

  it('selects latest immutable record for history-safe retrieval', () => {
    const records = [
      makeRecord({ id: 'pdf_1', documentType: 'invoice', documentId: 'inv_1', revision: 1, immutable: false }),
      makeRecord({ id: 'pdf_2', documentType: 'invoice', documentId: 'inv_1', revision: 2, immutable: true }),
      makeRecord({ id: 'pdf_3', documentType: 'invoice', documentId: 'inv_1', revision: 3, immutable: false }),
    ];

    const latestImmutable = selectLatestPdfRecord(records, {
      documentType: 'invoice',
      documentId: 'inv_1',
      immutableOnly: true,
    });
    expect(latestImmutable?.id).toBe('pdf_2');
  });

  it('allows regeneration without overwriting existing records', () => {
    const records = [makeRecord({ id: 'pdf_1', documentType: 'quote', documentId: 'q_1', revision: 1, immutable: true })];
    const result = canRegenerateWithoutOverwrite(records, {
      documentType: 'quote',
      documentId: 'q_1',
      generationMode: 'manual_regeneration',
      source: { source: 'pdf_archive' },
    });

    expect(result.allowed).toBe(true);
    expect(result.immutable).toBe(true);
  });
});
