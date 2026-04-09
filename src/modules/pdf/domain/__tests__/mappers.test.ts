import { describe, expect, it } from 'vitest';
import { Quote, Invoice } from '@/modules/accounting/domain/types';
import { createDefaultTemplateConfigForType } from '@/modules/templates/domain/defaults';
import { DocumentTemplate, DocumentTemplateVersion } from '@/modules/templates/domain/types';
import { mapInvoiceToRenderSnapshot, mapQuoteToRenderSnapshot } from '../mappers';

function makeTemplate(type: 'quote' | 'invoice'): DocumentTemplate {
  return {
    id: `tpl_${type}`,
    name: type === 'quote' ? 'Modern Quote' : 'Modern Invoice',
    description: '',
    type,
    status: 'published',
    currentPublishedVersionId: `tplver_${type}`,
    currentDraftVersionId: undefined,
    latestVersionNumber: 3,
    isDefaultForQuote: type === 'quote',
    isDefaultForInvoice: type === 'invoice',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  };
}

function makeTemplateVersion(type: 'quote' | 'invoice'): DocumentTemplateVersion {
  return {
    id: `tplver_${type}`,
    templateId: `tpl_${type}`,
    versionNumber: 3,
    status: 'published',
    config: createDefaultTemplateConfigForType(type),
    createdAt: '2026-04-01T00:00:00.000Z',
    publishedAt: '2026-04-01T00:00:00.000Z',
  };
}

describe('pdf render snapshot mappers', () => {
  it('maps quote + template version to snapshot payload with client context', () => {
    const quote: Quote = {
      id: 'q_1',
      quoteNumber: 'QUO-00012',
      clientId: 'cl_1',
      issueDate: '2026-04-05',
      expiryDate: '2026-04-20',
      currencyCode: 'ZAR',
      status: 'draft',
      templateId: 'tpl_quote',
      templateVersionId: 'tplver_quote',
      templateName: 'Modern Quote',
      notes: 'Quote notes',
      paymentTerms: '14 days',
      internalMemo: 'Memo',
      items: [
        {
          id: 'q_line_1',
          itemName: 'Accounting Retainer',
          description: 'Monthly support',
          quantity: 2,
          unitPriceMinor: 10000,
          discountPercent: 0,
          taxRatePercent: 15,
          position: 1,
        },
      ],
      documentDiscountPercent: 0,
      createdAt: '2026-04-05T00:00:00.000Z',
      updatedAt: '2026-04-05T00:00:00.000Z',
      statusHistory: [{ id: 'q_status_1', status: 'draft', at: '2026-04-05T00:00:00.000Z' }],
    };

    const snapshot = mapQuoteToRenderSnapshot({
      quote,
      template: makeTemplate('quote'),
      templateVersion: makeTemplateVersion('quote'),
      capturedAt: '2026-04-05T08:00:00.000Z',
      client: {
        name: 'Nautilus Labs',
        contactName: 'Lerato Nkosi',
        email: 'accounts@nautiluslabs.co.za',
        phone: '+27 11 555 0101',
      },
    });

    expect(snapshot.documentReference.documentType).toBe('quote');
    expect(snapshot.documentReference.documentId).toBe('q_1');
    expect(snapshot.template.versionId).toBe('tplver_quote');
    expect(snapshot.template.versionNumber).toBe(3);
    expect(snapshot.previewPayload.client.name).toBe('Nautilus Labs');
    expect(snapshot.previewPayload.documentNumber).toBe('QUO-00012');
  });

  it('maps invoice to template-version-aware snapshot and applies payment summary', () => {
    const invoice: Invoice = {
      id: 'inv_1',
      invoiceNumber: 'INV-00048',
      clientId: 'cl_2',
      issueDate: '2026-04-01',
      dueDate: '2026-04-14',
      currencyCode: 'ZAR',
      status: 'sent',
      templateId: 'tpl_invoice',
      templateVersionId: 'tplver_invoice',
      templateName: 'Modern Invoice',
      notes: 'Invoice notes',
      paymentTerms: 'Due on receipt',
      internalMemo: 'Internal note',
      items: [
        {
          id: 'i_line_1',
          itemName: 'Advisory',
          description: 'Quarterly advisory',
          quantity: 1,
          unitPriceMinor: 20000,
          discountPercent: 0,
          taxRatePercent: 15,
          position: 1,
        },
      ],
      documentDiscountPercent: 0,
      sourceQuoteId: undefined,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      statusHistory: [{ id: 'i_status_1', status: 'sent', at: '2026-04-01T00:00:00.000Z' }],
    };

    const snapshot = mapInvoiceToRenderSnapshot({
      invoice,
      template: makeTemplate('invoice'),
      templateVersion: makeTemplateVersion('invoice'),
      capturedAt: '2026-04-08T10:00:00.000Z',
      payments: [
        {
          invoiceId: 'inv_1',
          amountMinor: 5000,
        },
      ],
      client: {
        name: 'Silverstream Retail Group',
      },
    });

    expect(snapshot.documentReference.documentType).toBe('invoice');
    expect(snapshot.template.versionId).toBe('tplver_invoice');
    expect(snapshot.previewPayload.client.name).toBe('Silverstream Retail Group');
    expect(snapshot.previewPayload.totals.paidMinor).toBe(5000);
    expect(snapshot.previewPayload.totals.outstandingMinor).toBeGreaterThan(0);
  });
});
