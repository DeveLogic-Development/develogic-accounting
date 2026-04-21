import { describe, expect, it } from 'vitest';
import { AccountingState } from '@/modules/accounting/domain/types';
import { MasterClient } from '@/modules/master-data/domain/types';
import { EmailLogRecord } from '@/modules/emails/domain/types';
import {
  buildCustomerStatement,
  buildCustomerTransactions,
  filterCustomerMails,
  getCustomerReceivables,
} from '../customerWorkspace';

const baseAccountingState: AccountingState = {
  quotes: [
    {
      id: 'q_1',
      quoteNumber: 'QUO-00001',
      clientId: 'c_1',
      issueDate: '2026-04-01',
      expiryDate: '2026-04-15',
      currencyCode: 'ZAR',
      status: 'sent',
      notes: '',
      paymentTerms: '',
      internalMemo: '',
      items: [],
      documentDiscountPercent: 0,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      statusHistory: [],
    },
  ],
  invoices: [
    {
      id: 'i_1',
      invoiceNumber: 'INV-00001',
      clientId: 'c_1',
      issueDate: '2026-04-02',
      dueDate: '2026-04-30',
      currencyCode: 'ZAR',
      status: 'sent',
      notes: '',
      paymentTerms: '',
      internalMemo: '',
      items: [],
      documentDiscountPercent: 0,
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z',
      statusHistory: [],
    },
  ],
  payments: [
    {
      id: 'p_1',
      invoiceId: 'i_1',
      amountMinor: 2000,
      paymentDate: '2026-04-10',
      method: 'bank_transfer',
      createdAt: '2026-04-10T00:00:00.000Z',
    },
  ],
  quoteSequenceNext: 2,
  invoiceSequenceNext: 2,
};

const client: MasterClient = {
  id: 'c_1',
  customerType: 'business',
  displayName: 'Acme Trading',
  name: 'Acme Trading',
  companyName: 'Acme Trading (Pty) Ltd',
  customFields: {},
  reportingTags: [],
  billingAddress: {},
  shippingAddress: {},
  contactPersons: [],
  openingBalance: 50,
  unusedCredits: 0,
  isActive: true,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-15T00:00:00.000Z',
};

describe('customerWorkspace', () => {
  it('aggregates receivables by client', () => {
    const value = getCustomerReceivables('c_1', [
      {
        id: 'i_1',
        invoiceNumber: 'INV-00001',
        clientId: 'c_1',
        status: 'sent',
        issueDate: '2026-04-02',
        dueDate: '2026-04-30',
        totalMinor: 10000,
        paidMinor: 2000,
        outstandingMinor: 8000,
      },
    ]);

    expect(value).toBe(8000);
  });

  it('builds customer transaction rows across invoices, payments, and quotes', () => {
    const rows = buildCustomerTransactions('c_1', baseAccountingState, [
      {
        id: 'i_1',
        invoiceNumber: 'INV-00001',
        clientId: 'c_1',
        status: 'sent',
        issueDate: '2026-04-02',
        dueDate: '2026-04-30',
        totalMinor: 10000,
        paidMinor: 2000,
        outstandingMinor: 8000,
      },
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0]?.kind).toBe('payment');
    expect(rows[1]?.kind).toBe('invoice');
    expect(rows[2]?.kind).toBe('quote');
  });

  it('filters email logs by customer id', () => {
    const logs = [
      {
        id: 'log_1',
        status: 'sent',
        document: {
          documentType: 'invoice',
          documentId: 'i_1',
          documentNumber: 'INV-00001',
          documentStatus: 'sent',
          clientId: 'c_1',
          clientName: 'Acme',
        },
        recipient: { to: 'ops@acme.test' },
        subject: 'Invoice INV-00001',
        body: 'Body',
        bodySnippet: 'Body',
        templateKind: 'invoice_send',
        attemptedAt: '2026-04-10T10:00:00.000Z',
      },
      {
        id: 'log_2',
        status: 'failed',
        document: {
          documentType: 'quote',
          documentId: 'q_2',
          documentNumber: 'QUO-00002',
          documentStatus: 'sent',
          clientId: 'c_2',
          clientName: 'Other',
        },
        recipient: { to: 'other@test.com' },
        subject: 'Other',
        body: 'Other',
        bodySnippet: 'Other',
        templateKind: 'quote_send',
        attemptedAt: '2026-04-11T10:00:00.000Z',
      },
    ] as EmailLogRecord[];

    const filtered = filterCustomerMails('c_1', logs);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('log_1');
  });

  it('builds statement totals with opening balance, invoices, and payments', () => {
    const result = buildCustomerStatement({
      client,
      accounting: baseAccountingState,
      invoiceSummaries: [
        {
          id: 'i_1',
          invoiceNumber: 'INV-00001',
          clientId: 'c_1',
          status: 'sent',
          issueDate: '2026-04-02',
          dueDate: '2026-04-30',
          totalMinor: 10000,
          paidMinor: 2000,
          outstandingMinor: 8000,
        },
      ],
    });

    expect(result.summary.openingBalanceMinor).toBe(5000);
    expect(result.summary.invoicedMinor).toBe(10000);
    expect(result.summary.paymentsMinor).toBe(2000);
    expect(result.summary.balanceDueMinor).toBe(13000);
    expect(result.rows.at(-1)?.runningBalanceMinor).toBe(13000);
  });
});
