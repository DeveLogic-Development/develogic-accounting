import { describe, expect, it } from 'vitest';
import {
  buildInvoicePaymentReference,
  buildInvoicePaymentSubmissionUrl,
  deriveInvoicePaymentSubmissionState,
  isInvoiceEligibleForProofSubmission,
} from '../eft';
import { AccountingState, Invoice, InvoicePaymentSubmission } from '../types';

function createInvoice(overrides?: Partial<Invoice>): Invoice {
  return {
    id: 'inv_001',
    invoiceNumber: 'INV-00001',
    clientId: 'client_001',
    issueDate: '2026-04-01',
    dueDate: '2026-04-10',
    terms: 'due_on_receipt',
    currencyCode: 'ZAR',
    status: 'sent',
    notes: '',
    paymentTerms: 'Due on receipt',
    internalMemo: '',
    items: [
      {
        id: 'item_1',
        itemName: 'Service',
        description: 'Consulting',
        quantity: 1,
        unitPriceMinor: 10000,
        discountPercent: 0,
        taxRatePercent: 0,
        position: 1,
      },
    ],
    documentDiscountPercent: 0,
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
    statusHistory: [
      {
        id: 'st_1',
        status: 'sent',
        at: '2026-04-01T10:00:00.000Z',
      },
    ],
    publicPaymentEnabled: true,
    publicPaymentToken: 'token_001',
    ...overrides,
  };
}

function createState(overrides?: Partial<AccountingState>): AccountingState {
  return {
    quotes: [],
    invoices: [createInvoice()],
    payments: [],
    paymentSubmissions: [],
    recurringInvoiceProfiles: [],
    quoteSequenceNext: 1,
    invoiceSequenceNext: 2,
    ...overrides,
  };
}

describe('eft helpers', () => {
  it('builds payment reference from template placeholders', () => {
    const reference = buildInvoicePaymentReference({
      invoiceNumber: 'INV-00089',
      clientName: 'Open Vantage',
      instructionTemplate: 'Use {{client_name}} / {{invoice_number}}',
    });
    expect(reference).toBe('Use Open Vantage / INV-00089');
  });

  it('builds a public submission URL when base url and token are present', () => {
    expect(
      buildInvoicePaymentSubmissionUrl('https://app.develogic.digital/', 'abc123'),
    ).toBe('https://app.develogic.digital/pay/invoice/abc123');
  });

  it('derives submission state from most recent submission', () => {
    const submissions: InvoicePaymentSubmission[] = [
      {
        id: 'sub_old',
        invoiceId: 'inv_001',
        clientId: 'client_001',
        publicToken: 'token_001',
        status: 'submitted',
        submittedAmountMinor: 10000,
        submittedPaymentDate: '2026-04-02',
        proofFile: {
          id: 'file_1',
          fileName: 'proof.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          uploadedAt: '2026-04-02T10:00:00.000Z',
        },
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:00:00.000Z',
      },
      {
        id: 'sub_new',
        invoiceId: 'inv_001',
        clientId: 'client_001',
        publicToken: 'token_001',
        status: 'under_review',
        submittedAmountMinor: 10000,
        submittedPaymentDate: '2026-04-02',
        proofFile: {
          id: 'file_2',
          fileName: 'proof-2.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          uploadedAt: '2026-04-03T10:00:00.000Z',
        },
        createdAt: '2026-04-03T10:00:00.000Z',
        updatedAt: '2026-04-03T10:00:00.000Z',
      },
    ];

    expect(deriveInvoicePaymentSubmissionState(submissions)).toBe('under_review');
  });

  it('prevents proof submission when invoice is paid', () => {
    const invoice = createInvoice({ status: 'paid' });
    const result = isInvoiceEligibleForProofSubmission({
      invoice,
      state: createState({ invoices: [invoice] }),
      settings: {
        eftEnabled: true,
        eftPublicSubmissionEnabled: true,
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('already fully paid');
  });
});
