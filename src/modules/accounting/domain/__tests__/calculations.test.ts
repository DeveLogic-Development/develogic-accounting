import { describe, expect, it } from 'vitest';
import {
  calculateDocumentTotals,
  deriveInvoicePaymentSummary,
  deriveInvoiceStatus,
} from '../calculations';
import { Invoice, Payment } from '../types';

describe('calculateDocumentTotals', () => {
  it('calculates subtotal, discounts, tax, and total from shared rules', () => {
    const totals = calculateDocumentTotals(
      [
        {
          id: 'line_1',
          itemName: 'Accounting Retainer',
          description: 'Monthly service',
          quantity: 2,
          unitPriceMinor: 10000,
          discountPercent: 10,
          taxRatePercent: 15,
          position: 1,
        },
      ],
      5,
    );

    expect(totals.subtotalMinor).toBe(20000);
    expect(totals.lineDiscountMinor).toBe(2000);
    expect(totals.documentDiscountMinor).toBe(900);
    expect(totals.taxMinor).toBe(2565);
    expect(totals.totalMinor).toBe(19665);
  });
});

describe('deriveInvoicePaymentSummary', () => {
  const invoice: Invoice = {
    id: 'inv_001',
    invoiceNumber: 'INV-00001',
    clientId: 'cl_001',
    issueDate: '2026-04-01',
    dueDate: '2026-04-15',
    currencyCode: 'ZAR',
    status: 'sent',
    notes: '',
    paymentTerms: '',
    internalMemo: '',
    items: [
      {
        id: 'line_1',
        itemName: 'Service',
        description: '',
        quantity: 1,
        unitPriceMinor: 10000,
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
        id: 's_1',
        status: 'sent',
        at: '2026-04-01T00:00:00.000Z',
      },
    ],
  };

  it('derives partial payment status before due date', () => {
    const payments: Payment[] = [
      {
        id: 'pay_1',
        invoiceId: 'inv_001',
        amountMinor: 5000,
        paymentDate: '2026-04-10',
        createdAt: '2026-04-10T00:00:00.000Z',
      },
    ];

    const summary = deriveInvoicePaymentSummary(invoice, payments, '2026-04-10T00:00:00.000Z');
    expect(summary.paidMinor).toBe(5000);
    expect(summary.outstandingMinor).toBe(6500);
    expect(summary.derivedStatus).toBe('partially_paid');
  });

  it('derives overdue when due date is passed and still unpaid', () => {
    const summary = deriveInvoicePaymentSummary(invoice, [], '2026-04-30T00:00:00.000Z');
    expect(summary.derivedStatus).toBe('overdue');
  });

  it('keeps void invoices as void regardless of dates', () => {
    const status = deriveInvoiceStatus({
      currentStatus: 'void',
      dueDate: '2026-04-02',
      outstandingMinor: 12000,
      paidMinor: 0,
      nowIso: '2026-05-01T00:00:00.000Z',
    });

    expect(status).toBe('void');
  });
});
