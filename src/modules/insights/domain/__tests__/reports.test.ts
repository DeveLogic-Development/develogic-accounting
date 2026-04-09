import { describe, expect, it } from 'vitest';
import { InvoiceSummary, Payment, Quote, QuoteSummary } from '@/modules/accounting/domain/types';
import { EmailLogListRow } from '@/modules/emails/domain/types';
import { PdfArchiveListRow } from '@/modules/pdf/domain/types';
import {
  computeDashboardInsights,
  computeEmailActivitySummary,
  computeInvoiceAgingSummary,
  computeMonthlySalesSummary,
  computePaymentsSummary,
  computePdfArchiveSummary,
  computeQuotesConversionSummary,
} from '../reports';

const quoteSummaries: QuoteSummary[] = [
  {
    id: 'q_1',
    quoteNumber: 'QUO-00001',
    clientId: 'cl_1',
    status: 'accepted',
    issueDate: '2026-04-02',
    expiryDate: '2026-04-20',
    totalMinor: 120000,
  },
  {
    id: 'q_2',
    quoteNumber: 'QUO-00002',
    clientId: 'cl_2',
    status: 'converted',
    issueDate: '2026-03-05',
    expiryDate: '2026-03-20',
    totalMinor: 98000,
  },
  {
    id: 'q_3',
    quoteNumber: 'QUO-00003',
    clientId: 'cl_2',
    status: 'rejected',
    issueDate: '2026-03-01',
    expiryDate: '2026-03-15',
    totalMinor: 55000,
  },
];

const quotes: Quote[] = [
  {
    id: 'q_1',
    quoteNumber: 'QUO-00001',
    clientId: 'cl_1',
    issueDate: '2026-04-02',
    expiryDate: '2026-04-20',
    currencyCode: 'ZAR',
    status: 'accepted',
    notes: '',
    paymentTerms: '',
    internalMemo: '',
    items: [],
    documentDiscountPercent: 0,
    createdAt: '2026-04-02T00:00:00.000Z',
    updatedAt: '2026-04-02T00:00:00.000Z',
    statusHistory: [],
  },
  {
    id: 'q_2',
    quoteNumber: 'QUO-00002',
    clientId: 'cl_2',
    issueDate: '2026-03-05',
    expiryDate: '2026-03-20',
    currencyCode: 'ZAR',
    status: 'converted',
    notes: '',
    paymentTerms: '',
    internalMemo: '',
    items: [],
    documentDiscountPercent: 0,
    createdAt: '2026-03-05T00:00:00.000Z',
    updatedAt: '2026-03-05T00:00:00.000Z',
    statusHistory: [],
  },
];

const invoiceSummaries: InvoiceSummary[] = [
  {
    id: 'inv_1',
    invoiceNumber: 'INV-00001',
    clientId: 'cl_1',
    status: 'overdue',
    issueDate: '2026-04-01',
    dueDate: '2026-04-10',
    totalMinor: 180000,
    paidMinor: 50000,
    outstandingMinor: 130000,
  },
  {
    id: 'inv_2',
    invoiceNumber: 'INV-00002',
    clientId: 'cl_2',
    status: 'paid',
    issueDate: '2026-04-05',
    dueDate: '2026-04-19',
    totalMinor: 90000,
    paidMinor: 90000,
    outstandingMinor: 0,
  },
  {
    id: 'inv_3',
    invoiceNumber: 'INV-00003',
    clientId: 'cl_2',
    status: 'partially_paid',
    issueDate: '2026-03-15',
    dueDate: '2026-03-29',
    totalMinor: 140000,
    paidMinor: 50000,
    outstandingMinor: 90000,
  },
];

const payments: Payment[] = [
  {
    id: 'pay_1',
    invoiceId: 'inv_1',
    amountMinor: 50000,
    paymentDate: '2026-04-09',
    createdAt: '2026-04-09T00:00:00.000Z',
  },
  {
    id: 'pay_2',
    invoiceId: 'inv_2',
    amountMinor: 90000,
    paymentDate: '2026-04-12',
    createdAt: '2026-04-12T00:00:00.000Z',
  },
];

const emailRows: EmailLogListRow[] = [
  {
    id: 'em_1',
    status: 'sent',
    documentType: 'invoice',
    documentId: 'inv_1',
    documentNumber: 'INV-00001',
    recipientEmail: 'accounts@client.com',
    subject: 'Invoice INV-00001',
    bodySnippet: 'body',
    attemptedAt: '2026-04-09',
    sentAt: '2026-04-09',
    hasAttachment: true,
  },
  {
    id: 'em_2',
    status: 'failed',
    documentType: 'quote',
    documentId: 'q_1',
    documentNumber: 'QUO-00001',
    recipientEmail: 'sales@client.com',
    subject: 'Quote QUO-00001',
    bodySnippet: 'body',
    attemptedAt: '2026-04-10',
    hasAttachment: true,
    errorMessage: 'SMTP timeout',
  },
];

const pdfRows: PdfArchiveListRow[] = [
  {
    id: 'pdf_1',
    documentType: 'quote',
    documentId: 'q_1',
    documentNumber: 'QUO-00001',
    documentStatus: 'accepted',
    clientName: 'Client A',
    revision: 2,
    generationMode: 'historical_archive',
    immutable: true,
    templateName: 'Modern Quote',
    templateVersionNumber: 2,
    generatedAt: '2026-04-09',
    fileName: 'quote-quo-00001-v2.pdf',
    sizeBytes: 1024,
    checksum: 'deadbeef',
  },
  {
    id: 'pdf_2',
    documentType: 'invoice',
    documentId: 'inv_1',
    documentNumber: 'INV-00001',
    documentStatus: 'sent',
    clientName: 'Client A',
    revision: 1,
    generationMode: 'draft_preview',
    immutable: false,
    templateName: 'Modern Invoice',
    templateVersionNumber: 3,
    generatedAt: '2026-04-10',
    fileName: 'invoice-inv-00001-v1.pdf',
    sizeBytes: 1100,
    checksum: 'feedbeef',
  },
];

const clientNameById = new Map([
  ['cl_1', 'Client A'],
  ['cl_2', 'Client B'],
]);

describe('insight aggregations', () => {
  it('calculates invoice aging buckets', () => {
    const summary = computeInvoiceAgingSummary(invoiceSummaries, '2026-04-20');
    expect(summary.totalOutstandingMinor).toBe(220000);
    expect(summary.buckets.find((bucket) => bucket.label === '1-30')?.count).toBeGreaterThan(0);
  });

  it('calculates quote conversion summary and accepted-not-converted', () => {
    const summary = computeQuotesConversionSummary({ quoteSummaries, quotes });
    expect(summary.totalQuotes).toBe(3);
    expect(summary.convertedQuotes).toBe(1);
    expect(summary.acceptedNotConvertedCount).toBe(1);
  });

  it('calculates monthly sales totals in range', () => {
    const summary = computeMonthlySalesSummary({
      invoiceSummaries,
      payments,
      range: { preset: 'custom', from: '2026-04-01', to: '2026-04-30' },
    });
    expect(summary.invoicesCount).toBe(2);
    expect(summary.totalInvoicedMinor).toBe(270000);
    expect(summary.totalPaidMinor).toBe(140000);
  });

  it('aggregates payments with top paying clients', () => {
    const summary = computePaymentsSummary({
      payments,
      invoiceSummaries,
      range: { preset: 'all_time' },
      clientNameById,
    });

    expect(summary.paymentsCount).toBe(2);
    expect(summary.totalPaidMinor).toBe(140000);
    expect(summary.topPayingClients[0].clientName).toBe('Client B');
  });

  it('summarizes email and PDF operational activity', () => {
    const emailSummary = computeEmailActivitySummary({
      emailRows,
      range: { preset: 'all_time' },
    });
    const pdfSummary = computePdfArchiveSummary({
      pdfRows,
      range: { preset: 'all_time' },
    });

    expect(emailSummary.failedSends).toBe(1);
    expect(emailSummary.quoteSends).toBe(1);
    expect(pdfSummary.totalGenerated).toBe(2);
    expect(pdfSummary.immutableCount).toBe(1);
  });

  it('produces dashboard insights including top clients and recent failed email', () => {
    const insights = computeDashboardInsights({
      quoteSummaries,
      quotes,
      invoiceSummaries,
      payments,
      emailRows,
      pdfRows,
      clientNameById,
      nowIsoDate: '2026-04-20',
    });

    expect(insights.financial.totalOutstandingMinor).toBe(220000);
    expect(insights.quotes.acceptedNotConvertedCount).toBe(1);
    expect(insights.topClientsByOutstanding[0].clientName).toBe('Client A');
    expect(insights.recentFailedEmails.length).toBe(1);
  });
});
