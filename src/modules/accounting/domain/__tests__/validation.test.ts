import { describe, expect, it } from 'vitest';
import { validateInvoiceForm, validatePaymentInput, validateQuoteForm } from '../validation';

describe('validation', () => {
  it('flags invalid quote form fields', () => {
    const result = validateQuoteForm({
      clientId: '',
      issueDate: '2026-04-10',
      expiryDate: '2026-04-09',
      templateId: undefined,
      templateVersionId: undefined,
      quoteNumber: 'bad number !',
      notes: '',
      paymentTerms: '',
      adjustment: Number.NaN,
      recipientEmails: ['valid@example.com', 'not-an-email'],
      internalMemo: '',
      documentDiscountPercent: 0,
      items: [
        {
          id: 'line_1',
          itemName: '',
          description: '',
          quantity: 0,
          unitPrice: -1,
          discountPercent: 101,
          taxRatePercent: -1,
          position: 1,
        },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('accepts a valid invoice form', () => {
    const result = validateInvoiceForm({
      clientId: 'cl_001',
      issueDate: '2026-04-01',
      dueDate: '2026-04-30',
      templateId: 'tpl_001',
      templateVersionId: 'tplver_001',
      notes: '',
      paymentTerms: '',
      internalMemo: '',
      documentDiscountPercent: 0,
      items: [
        {
          id: 'line_1',
          itemName: 'Consulting',
          description: '',
          quantity: 1,
          unitPrice: 120,
          discountPercent: 0,
          taxRatePercent: 15,
          position: 1,
        },
      ],
    });

    expect(result.isValid).toBe(true);
  });

  it('rejects overpayment and zero payment values', () => {
    const invalidOverpay = validatePaymentInput(
      {
        amount: 200,
        paymentDate: '2026-04-11',
      },
      100,
    );

    const invalidZero = validatePaymentInput(
      {
        amount: 0,
        paymentDate: '2026-04-11',
      },
      100,
    );

    expect(invalidOverpay.isValid).toBe(false);
    expect(invalidZero.isValid).toBe(false);
  });
});
