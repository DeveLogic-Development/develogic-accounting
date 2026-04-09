import { InvoiceSummary, Payment, Quote, QuoteSummary } from '@/modules/accounting/domain/types';
import { EmailLogListRow } from '@/modules/emails/domain/types';
import { PdfArchiveListRow } from '@/modules/pdf/domain/types';
import { isIsoDateWithinRange } from './date-range';
import {
  AgingBucket,
  ClientInsightRow,
  DashboardInsights,
  DateRange,
  EmailActivitySummary,
  InvoiceAgingSummary,
  MonthlySalesSummary,
  PaymentsSummary,
  PdfArchiveSummary,
  ReportsSummary,
  TrendPoint,
  QuotesConversionSummary,
} from './types';

interface InsightInput {
  quoteSummaries: QuoteSummary[];
  quotes: Quote[];
  invoiceSummaries: InvoiceSummary[];
  payments: Payment[];
  emailRows: EmailLogListRow[];
  pdfRows: PdfArchiveListRow[];
  clientNameById: Map<string, string>;
  nowIsoDate?: string;
}

function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

function monthLabel(key: string): string {
  const date = new Date(`${key}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat('en-ZA', { month: 'short', year: '2-digit' }).format(date);
}

function buildTrendPoints(input: {
  invoiceSummaries: InvoiceSummary[];
  payments: Payment[];
  months: number;
  now: Date;
}): TrendPoint[] {
  const keys: string[] = [];
  for (let i = input.months - 1; i >= 0; i -= 1) {
    const date = new Date(input.now.getFullYear(), input.now.getMonth() - i, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }

  return keys.map((key) => {
    const invoicedMinor = input.invoiceSummaries
      .filter((invoice) => monthKey(invoice.issueDate) === key)
      .reduce((sum, invoice) => sum + invoice.totalMinor, 0);

    const paidMinor = input.payments
      .filter((payment) => monthKey(payment.paymentDate) === key)
      .reduce((sum, payment) => sum + payment.amountMinor, 0);

    return {
      monthKey: key,
      label: monthLabel(key),
      invoicedMinor,
      paidMinor,
    };
  });
}

function createClientInsights(input: {
  invoiceSummaries: InvoiceSummary[];
  clientNameById: Map<string, string>;
  now: Date;
}): ClientInsightRow[] {
  const today = input.now.toISOString().slice(0, 10);
  const byClient = new Map<string, ClientInsightRow>();

  input.invoiceSummaries.forEach((invoice) => {
    const existing = byClient.get(invoice.clientId) ?? {
      clientId: invoice.clientId,
      clientName: input.clientNameById.get(invoice.clientId) ?? 'Unknown client',
      invoiceValueMinor: 0,
      outstandingMinor: 0,
      overdueMinor: 0,
      invoicesCount: 0,
    };

    existing.invoiceValueMinor += invoice.totalMinor;
    existing.outstandingMinor += invoice.outstandingMinor;
    existing.invoicesCount += 1;

    if (invoice.outstandingMinor > 0 && invoice.dueDate < today) {
      existing.overdueMinor += invoice.outstandingMinor;
    }

    byClient.set(invoice.clientId, existing);
  });

  return Array.from(byClient.values());
}

function createRecentActivity(input: InsightInput): DashboardInsights['recentActivity'] {
  const activity: DashboardInsights['recentActivity'] = [];

  input.invoiceSummaries
    .filter((invoice) => invoice.status === 'sent')
    .slice(0, 4)
    .forEach((invoice) => {
      activity.push({
        id: `inv_sent_${invoice.id}`,
        type: 'invoice_sent',
        timestamp: invoice.issueDate,
        title: `Invoice sent: ${invoice.invoiceNumber}`,
        detail: `${input.clientNameById.get(invoice.clientId) ?? 'Unknown client'}`,
      });
    });

  input.quoteSummaries
    .filter((quote) => quote.status === 'sent')
    .slice(0, 4)
    .forEach((quote) => {
      activity.push({
        id: `quote_sent_${quote.id}`,
        type: 'quote_sent',
        timestamp: quote.issueDate,
        title: `Quote sent: ${quote.quoteNumber}`,
        detail: `${input.clientNameById.get(quote.clientId) ?? 'Unknown client'}`,
      });
    });

  input.payments.slice(0, 5).forEach((payment) => {
    activity.push({
      id: `payment_${payment.id}`,
      type: 'payment',
      timestamp: payment.paymentDate,
      title: 'Payment recorded',
      detail: `${(payment.amountMinor / 100).toFixed(2)} on ${payment.paymentDate}`,
    });
  });

  input.emailRows
    .filter((row) => row.status === 'failed')
    .slice(0, 3)
    .forEach((row) => {
      activity.push({
        id: `email_failed_${row.id}`,
        type: 'email_failed',
        timestamp: row.attemptedAt,
        title: `Email failed: ${row.documentNumber}`,
        detail: row.errorMessage ?? row.recipientEmail,
      });
    });

  input.pdfRows.slice(0, 3).forEach((row) => {
    activity.push({
      id: `pdf_${row.id}`,
      type: 'pdf_generated',
      timestamp: row.generatedAt,
      title: `PDF generated: ${row.documentNumber}`,
      detail: row.fileName,
    });
  });

  return activity.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 10);
}

export function computeDashboardInsights(input: InsightInput): DashboardInsights {
  const now = input.nowIsoDate ? new Date(input.nowIsoDate) : new Date();
  const currentMonthKey = monthKey(now.toISOString());
  const today = now.toISOString().slice(0, 10);

  const totalInvoicedThisMonthMinor = input.invoiceSummaries
    .filter((invoice) => monthKey(invoice.issueDate) === currentMonthKey)
    .reduce((sum, invoice) => sum + invoice.totalMinor, 0);

  const totalPaidThisMonthMinor = input.payments
    .filter((payment) => monthKey(payment.paymentDate) === currentMonthKey)
    .reduce((sum, payment) => sum + payment.amountMinor, 0);

  const totalOutstandingMinor = input.invoiceSummaries
    .filter((invoice) => invoice.status !== 'void')
    .reduce((sum, invoice) => sum + invoice.outstandingMinor, 0);

  const overdueInvoices = input.invoiceSummaries.filter(
    (invoice) => invoice.outstandingMinor > 0 && invoice.dueDate < today && invoice.status !== 'void',
  );

  const overdueTotalMinor = overdueInvoices.reduce((sum, invoice) => sum + invoice.outstandingMinor, 0);
  const partiallyPaidTotalMinor = input.invoiceSummaries
    .filter((invoice) => invoice.status === 'partially_paid')
    .reduce((sum, invoice) => sum + invoice.outstandingMinor, 0);

  const acceptedNotConverted = input.quotes.filter(
    (quote) => quote.status === 'accepted' && !quote.convertedInvoiceId,
  );

  const clientInsights = createClientInsights({
    invoiceSummaries: input.invoiceSummaries,
    clientNameById: input.clientNameById,
    now,
  });

  return {
    financial: {
      totalInvoicedThisMonthMinor,
      totalPaidThisMonthMinor,
      totalOutstandingMinor,
      overdueTotalMinor,
      partiallyPaidTotalMinor,
    },
    quotes: {
      draftCount: input.quoteSummaries.filter((quote) => quote.status === 'draft').length,
      sentCount: input.quoteSummaries.filter((quote) => quote.status === 'sent').length,
      acceptedCount: input.quoteSummaries.filter((quote) => quote.status === 'accepted').length,
      acceptedNotConvertedCount: acceptedNotConverted.length,
      expiredCount: input.quoteSummaries.filter((quote) => quote.status === 'expired').length,
    },
    invoices: {
      draftCount: input.invoiceSummaries.filter((invoice) => invoice.status === 'draft').length,
      openOrSentCount: input.invoiceSummaries.filter((invoice) =>
        ['approved', 'sent'].includes(invoice.status),
      ).length,
      overdueCount: overdueInvoices.length,
      paidCount: input.invoiceSummaries.filter((invoice) => invoice.status === 'paid').length,
      partiallyPaidCount: input.invoiceSummaries.filter((invoice) => invoice.status === 'partially_paid').length,
    },
    trends: buildTrendPoints({
      invoiceSummaries: input.invoiceSummaries,
      payments: input.payments,
      months: 6,
      now,
    }),
    topClientsByInvoiceValue: clientInsights
      .slice()
      .sort((a, b) => b.invoiceValueMinor - a.invoiceValueMinor)
      .slice(0, 5),
    topClientsByOutstanding: clientInsights
      .slice()
      .sort((a, b) => b.outstandingMinor - a.outstandingMinor)
      .filter((entry) => entry.outstandingMinor > 0)
      .slice(0, 5),
    clientsWithOverdue: clientInsights
      .filter((entry) => entry.overdueMinor > 0)
      .sort((a, b) => b.overdueMinor - a.overdueMinor)
      .slice(0, 5),
    recentActivity: createRecentActivity(input),
    recentPayments: input.payments.slice().sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)).slice(0, 5),
    recentInvoiceSummaries: input.invoiceSummaries.slice(0, 5),
    recentQuoteSummaries: input.quoteSummaries.slice(0, 5),
    recentFailedEmails: input.emailRows
      .filter((row) => row.status === 'failed')
      .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
      .slice(0, 5),
    recentPdfArchive: input.pdfRows.slice().sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).slice(0, 5),
  };
}

export function computeInvoiceAgingSummary(
  invoiceSummaries: InvoiceSummary[],
  nowIsoDate = new Date().toISOString().slice(0, 10),
): InvoiceAgingSummary {
  const buckets: AgingBucket[] = [
    { label: 'Current', count: 0, outstandingMinor: 0 },
    { label: '1-30', count: 0, outstandingMinor: 0 },
    { label: '31-60', count: 0, outstandingMinor: 0 },
    { label: '61-90', count: 0, outstandingMinor: 0 },
    { label: '90+', count: 0, outstandingMinor: 0 },
  ];

  invoiceSummaries.forEach((invoice) => {
    if (invoice.outstandingMinor <= 0 || invoice.status === 'void') return;

    const due = new Date(invoice.dueDate);
    const now = new Date(nowIsoDate);
    const diffDays = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));

    let target: AgingBucket;
    if (diffDays <= 0) target = buckets[0];
    else if (diffDays <= 30) target = buckets[1];
    else if (diffDays <= 60) target = buckets[2];
    else if (diffDays <= 90) target = buckets[3];
    else target = buckets[4];

    target.count += 1;
    target.outstandingMinor += invoice.outstandingMinor;
  });

  return {
    buckets,
    totalOutstandingMinor: buckets.reduce((sum, bucket) => sum + bucket.outstandingMinor, 0),
  };
}

export function computeQuotesConversionSummary(input: {
  quoteSummaries: QuoteSummary[];
  quotes: Quote[];
}): QuotesConversionSummary {
  const totalQuotes = input.quoteSummaries.length;
  const acceptedQuotes = input.quoteSummaries.filter((quote) => quote.status === 'accepted').length;
  const rejectedQuotes = input.quoteSummaries.filter((quote) => quote.status === 'rejected').length;
  const expiredQuotes = input.quoteSummaries.filter((quote) => quote.status === 'expired').length;
  const convertedQuotes = input.quoteSummaries.filter((quote) => quote.status === 'converted').length;
  const acceptedNotConverted = input.quotes.filter(
    (quote) => quote.status === 'accepted' && !quote.convertedInvoiceId,
  );

  const acceptedNotConvertedValueMinor = acceptedNotConverted.reduce((sum, quote) => {
    const summary = input.quoteSummaries.find((entry) => entry.id === quote.id);
    return sum + (summary?.totalMinor ?? 0);
  }, 0);

  return {
    totalQuotes,
    acceptedQuotes,
    rejectedQuotes,
    expiredQuotes,
    convertedQuotes,
    acceptedNotConvertedCount: acceptedNotConverted.length,
    acceptedNotConvertedValueMinor,
    conversionRatePercent: totalQuotes === 0 ? 0 : Math.round((convertedQuotes / totalQuotes) * 10000) / 100,
  };
}

export function computeMonthlySalesSummary(input: {
  invoiceSummaries: InvoiceSummary[];
  payments: Payment[];
  range: DateRange;
}): MonthlySalesSummary {
  const invoices = input.invoiceSummaries.filter((invoice) => isIsoDateWithinRange(invoice.issueDate, input.range));
  const payments = input.payments.filter((payment) => isIsoDateWithinRange(payment.paymentDate, input.range));

  const totalInvoicedMinor = invoices.reduce((sum, invoice) => sum + invoice.totalMinor, 0);
  const totalPaidMinor = payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  const totalOutstandingMinor = invoices.reduce((sum, invoice) => sum + invoice.outstandingMinor, 0);

  return {
    invoicesCount: invoices.length,
    totalInvoicedMinor,
    totalPaidMinor,
    totalOutstandingMinor,
    averageInvoiceValueMinor: invoices.length === 0 ? 0 : Math.round(totalInvoicedMinor / invoices.length),
  };
}

export function computePaymentsSummary(input: {
  payments: Payment[];
  invoiceSummaries: InvoiceSummary[];
  range: DateRange;
  clientNameById: Map<string, string>;
}): PaymentsSummary {
  const payments = input.payments.filter((payment) => isIsoDateWithinRange(payment.paymentDate, input.range));
  const monthlyTotals = buildTrendPoints({
    invoiceSummaries: [],
    payments,
    months: 6,
    now: new Date(),
  });

  const invoiceClientById = new Map(input.invoiceSummaries.map((invoice) => [invoice.id, invoice.clientId]));
  const byClient = new Map<string, number>();

  payments.forEach((payment) => {
    const clientId = invoiceClientById.get(payment.invoiceId);
    if (!clientId) return;
    byClient.set(clientId, (byClient.get(clientId) ?? 0) + payment.amountMinor);
  });

  const topPayingClients = Array.from(byClient.entries())
    .map(([clientId, paidMinor]) => ({
      clientId,
      clientName: input.clientNameById.get(clientId) ?? 'Unknown client',
      paidMinor,
    }))
    .sort((a, b) => b.paidMinor - a.paidMinor)
    .slice(0, 5);

  return {
    paymentsCount: payments.length,
    totalPaidMinor: payments.reduce((sum, payment) => sum + payment.amountMinor, 0),
    monthlyTotals,
    topPayingClients,
  };
}

export function computeEmailActivitySummary(input: {
  emailRows: EmailLogListRow[];
  range: DateRange;
}): EmailActivitySummary {
  const rows = input.emailRows.filter((row) => isIsoDateWithinRange(row.attemptedAt, input.range));

  return {
    totalSends: rows.length,
    successfulSends: rows.filter((row) => row.status === 'sent').length,
    failedSends: rows.filter((row) => row.status === 'failed').length,
    quoteSends: rows.filter((row) => row.documentType === 'quote').length,
    invoiceSends: rows.filter((row) => row.documentType === 'invoice').length,
    recentFailures: rows
      .filter((row) => row.status === 'failed')
      .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
      .slice(0, 5),
  };
}

export function computePdfArchiveSummary(input: {
  pdfRows: PdfArchiveListRow[];
  range: DateRange;
}): PdfArchiveSummary {
  const rows = input.pdfRows.filter((row) => isIsoDateWithinRange(row.generatedAt, input.range));
  return {
    totalGenerated: rows.length,
    quotePdfs: rows.filter((row) => row.documentType === 'quote').length,
    invoicePdfs: rows.filter((row) => row.documentType === 'invoice').length,
    immutableCount: rows.filter((row) => row.immutable).length,
    recent: rows.slice().sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).slice(0, 5),
  };
}

export function computeReportsSummary(input: {
  quoteSummaries: QuoteSummary[];
  quotes: Quote[];
  invoiceSummaries: InvoiceSummary[];
  payments: Payment[];
  emailRows: EmailLogListRow[];
  pdfRows: PdfArchiveListRow[];
  range: DateRange;
  clientNameById: Map<string, string>;
  nowIsoDate?: string;
}): ReportsSummary {
  return {
    invoiceAging: computeInvoiceAgingSummary(input.invoiceSummaries, input.nowIsoDate),
    quoteConversion: computeQuotesConversionSummary({
      quoteSummaries: input.quoteSummaries,
      quotes: input.quotes,
    }),
    monthlySales: computeMonthlySalesSummary({
      invoiceSummaries: input.invoiceSummaries,
      payments: input.payments,
      range: input.range,
    }),
    payments: computePaymentsSummary({
      payments: input.payments,
      invoiceSummaries: input.invoiceSummaries,
      range: input.range,
      clientNameById: input.clientNameById,
    }),
    emailActivity: computeEmailActivitySummary({
      emailRows: input.emailRows,
      range: input.range,
    }),
    pdfArchive: computePdfArchiveSummary({
      pdfRows: input.pdfRows,
      range: input.range,
    }),
  };
}
