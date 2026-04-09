import { describe, expect, it } from 'vitest';
import { convertQuoteToInvoice } from '../conversion';
import { Quote } from '../types';

describe('convertQuoteToInvoice', () => {
  it('maps quote fields into an approved invoice with source linkage', () => {
    const quote: Quote = {
      id: 'q_001',
      quoteNumber: 'QUO-00001',
      clientId: 'cl_001',
      issueDate: '2026-04-01',
      expiryDate: '2026-04-20',
      currencyCode: 'ZAR',
      status: 'accepted',
      templateName: 'Modern Quote',
      notes: 'Quote notes',
      paymentTerms: '14 days',
      internalMemo: 'Internal',
      items: [
        {
          id: 'q_line_1',
          itemName: 'Consulting',
          description: 'Monthly consulting',
          quantity: 1,
          unitPriceMinor: 12000,
          discountPercent: 0,
          taxRatePercent: 15,
          position: 1,
        },
      ],
      documentDiscountPercent: 0,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      statusHistory: [
        {
          id: 'qs_1',
          status: 'accepted',
          at: '2026-04-03T00:00:00.000Z',
        },
      ],
    };

    const invoice = convertQuoteToInvoice({
      quote,
      invoiceId: 'inv_001',
      invoiceNumber: 'INV-00001',
      nowIso: '2026-04-04T00:00:00.000Z',
      dueDate: '2026-04-18',
    });

    expect(invoice.status).toBe('approved');
    expect(invoice.sourceQuoteId).toBe('q_001');
    expect(invoice.clientId).toBe('cl_001');
    expect(invoice.invoiceNumber).toBe('INV-00001');
    expect(invoice.items[0].id).not.toBe('q_line_1');
    expect(invoice.statusHistory[0].note).toContain('QUO-00001');
  });
});
