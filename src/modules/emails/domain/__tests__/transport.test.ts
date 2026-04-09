import { describe, expect, it } from 'vitest';
import { createDefaultTemplateConfigForType } from '@/modules/templates/domain/defaults';
import { buildEmailTransportPayload } from '../transport';
import { EmailComposeDraft } from '../types';
import { PdfArchiveRecord } from '@/modules/pdf/domain/types';

function makeRecord(dataUrl = 'data:application/pdf;base64,abc123'): PdfArchiveRecord {
  return {
    id: 'pdf_1',
    revision: 1,
    status: 'generated',
    generationMode: 'historical_archive',
    immutable: true,
    generatedAt: '2026-04-09T12:00:00.000Z',
    source: { source: 'system' },
    documentReference: {
      documentType: 'quote',
      documentId: 'q_1',
      documentNumber: 'QUO-00012',
      documentStatus: 'sent',
    },
    versionContext: {
      templateId: 'tpl_1',
      templateVersionId: 'tplver_1',
      templateName: 'Modern Quote',
      templateVersionNumber: 2,
    },
    snapshot: {
      renderSchemaVersion: 1,
      capturedAt: '2026-04-09T12:00:00.000Z',
      documentReference: {
        documentType: 'quote',
        documentId: 'q_1',
        documentNumber: 'QUO-00012',
        documentStatus: 'sent',
      },
      currencyCode: 'ZAR',
      template: {
        id: 'tpl_1',
        versionId: 'tplver_1',
        name: 'Modern Quote',
        versionNumber: 2,
        config: createDefaultTemplateConfigForType('quote'),
      },
      previewPayload: {
        documentType: 'quote',
        documentTitle: 'Quote',
        documentNumber: 'QUO-00012',
        issueDate: '2026-04-09',
        dueOrExpiryLabel: 'Valid Until',
        dueOrExpiryDate: '2026-04-23',
        business: { name: 'DeveLogic', addressLines: [] },
        client: { name: 'Nautilus Labs', addressLines: [] },
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
      fileName: 'quote-quo-00012-v1.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'deadbeef',
      storageKey: 'pdf/quote/q_1/quote-quo-00012-v1.pdf',
      dataUrl,
    },
  };
}

describe('transport payload builder', () => {
  const draft: EmailComposeDraft = {
    document: {
      documentType: 'quote',
      documentId: 'q_1',
      documentNumber: 'QUO-00012',
      documentStatus: 'sent',
      clientId: 'cl_1',
      clientName: 'Nautilus Labs',
    },
    templateKind: 'quote_send',
    recipient: {
      to: 'accounts@nautiluslabs.co.za',
    },
    subject: 'Quote QUO-00012',
    body: 'Please find attached.',
  };

  it('builds a valid transport payload with base64 attachment content', () => {
    const payload = buildEmailTransportPayload({
      draft,
      attachmentRecord: makeRecord(),
    });

    expect(payload).not.toBeNull();
    expect(payload?.attachment.contentBase64).toBe('abc123');
    expect(payload?.recipient.to).toBe('accounts@nautiluslabs.co.za');
  });

  it('returns null for invalid data URL attachment content', () => {
    const payload = buildEmailTransportPayload({
      draft,
      attachmentRecord: makeRecord('invalid-data-url'),
    });

    expect(payload).toBeNull();
  });
});
