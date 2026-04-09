import { describe, expect, it } from 'vitest';
import { createDefaultTemplateConfigForType } from '@/modules/templates/domain/defaults';
import { resolveAttachmentRecordForSend } from '../attachments';
import { PdfArchiveRecord } from '@/modules/pdf/domain/types';

function makePdfRecord(input: {
  id: string;
  documentType: 'quote' | 'invoice';
  documentId: string;
  revision: number;
  immutable: boolean;
}): PdfArchiveRecord {
  return {
    id: input.id,
    revision: input.revision,
    status: 'generated',
    generationMode: input.immutable ? 'historical_archive' : 'draft_preview',
    immutable: input.immutable,
    generatedAt: '2026-04-09T12:00:00.000Z',
    source: { source: 'system' },
    documentReference: {
      documentType: input.documentType,
      documentId: input.documentId,
      documentNumber: input.documentType === 'quote' ? 'QUO-00012' : 'INV-00048',
      documentStatus: input.immutable ? 'sent' : 'draft',
    },
    versionContext: {
      templateId: 'tpl_1',
      templateVersionId: 'tplver_1',
      templateName: 'Modern',
      templateVersionNumber: 2,
    },
    snapshot: {
      renderSchemaVersion: 1,
      capturedAt: '2026-04-09T12:00:00.000Z',
      documentReference: {
        documentType: input.documentType,
        documentId: input.documentId,
        documentNumber: input.documentType === 'quote' ? 'QUO-00012' : 'INV-00048',
        documentStatus: input.immutable ? 'sent' : 'draft',
      },
      currencyCode: 'ZAR',
      template: {
        id: 'tpl_1',
        versionId: 'tplver_1',
        name: 'Modern',
        versionNumber: 2,
        config: createDefaultTemplateConfigForType(input.documentType),
      },
      previewPayload: {
        documentType: input.documentType,
        documentTitle: input.documentType === 'quote' ? 'Quote' : 'Invoice',
        documentNumber: input.documentType === 'quote' ? 'QUO-00012' : 'INV-00048',
        issueDate: '2026-04-09',
        dueOrExpiryLabel: 'Due',
        dueOrExpiryDate: '2026-04-20',
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
      storageKey: 'pdf/path/file.pdf',
      dataUrl: 'data:application/pdf;base64,abc',
    },
  };
}

describe('attachment resolution', () => {
  it('uses resend attachment reference when available', async () => {
    const resendRecord = makePdfRecord({
      id: 'pdf_1',
      documentType: 'quote',
      documentId: 'q_1',
      revision: 1,
      immutable: true,
    });

    const result = await resolveAttachmentRecordForSend({
      documentType: 'quote',
      documentId: 'q_1',
      resendAttachmentRecordId: 'pdf_1',
      getRecordById: () => resendRecord,
      getLatestImmutableRecord: () => undefined,
      generateHistoricalArchive: async () => ({ ok: false, error: 'not expected' }),
    });

    expect(result.ok).toBe(true);
    expect(result.record?.id).toBe('pdf_1');
  });

  it('falls back to latest immutable archive before generating', async () => {
    const immutableRecord = makePdfRecord({
      id: 'pdf_2',
      documentType: 'invoice',
      documentId: 'inv_1',
      revision: 3,
      immutable: true,
    });

    const result = await resolveAttachmentRecordForSend({
      documentType: 'invoice',
      documentId: 'inv_1',
      getRecordById: () => undefined,
      getLatestImmutableRecord: () => immutableRecord,
      generateHistoricalArchive: async () => ({ ok: false, error: 'not expected' }),
    });

    expect(result.ok).toBe(true);
    expect(result.record?.id).toBe('pdf_2');
    expect(result.generated).toBeUndefined();
  });

  it('generates historical archive when immutable record is missing', async () => {
    const generatedRecord = makePdfRecord({
      id: 'pdf_3',
      documentType: 'quote',
      documentId: 'q_2',
      revision: 1,
      immutable: true,
    });

    const result = await resolveAttachmentRecordForSend({
      documentType: 'quote',
      documentId: 'q_2',
      getRecordById: () => undefined,
      getLatestImmutableRecord: () => undefined,
      generateHistoricalArchive: async () => ({ ok: true, data: generatedRecord }),
    });

    expect(result.ok).toBe(true);
    expect(result.record?.id).toBe('pdf_3');
    expect(result.generated).toBe(true);
  });

  it('rejects non-immutable preferred records and generates a safe immutable archive', async () => {
    const draftRecord = makePdfRecord({
      id: 'pdf_draft',
      documentType: 'quote',
      documentId: 'q_9',
      revision: 1,
      immutable: false,
    });
    const generatedRecord = makePdfRecord({
      id: 'pdf_final',
      documentType: 'quote',
      documentId: 'q_9',
      revision: 2,
      immutable: true,
    });

    const result = await resolveAttachmentRecordForSend({
      documentType: 'quote',
      documentId: 'q_9',
      preferredRecordId: 'pdf_draft',
      getRecordById: () => draftRecord,
      getLatestImmutableRecord: () => undefined,
      generateHistoricalArchive: async () => ({ ok: true, data: generatedRecord }),
    });

    expect(result.ok).toBe(true);
    expect(result.record?.id).toBe('pdf_final');
    expect(result.generated).toBe(true);
  });
});
