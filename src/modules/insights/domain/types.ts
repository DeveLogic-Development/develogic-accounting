import { Payment, InvoiceSummary, QuoteSummary } from '@/modules/accounting/domain/types';
import { EmailLogListRow } from '@/modules/emails/domain/types';
import { PdfArchiveListRow } from '@/modules/pdf/domain/types';

export type DateRangePreset = 'current_month' | 'previous_month' | 'last_30_days' | 'all_time' | 'custom';

export interface DateRange {
  from?: string;
  to?: string;
  preset: DateRangePreset;
}

export interface DashboardFinancialKpis {
  totalInvoicedThisMonthMinor: number;
  totalPaidThisMonthMinor: number;
  totalOutstandingMinor: number;
  overdueTotalMinor: number;
  partiallyPaidTotalMinor: number;
}

export interface DashboardQuoteKpis {
  draftCount: number;
  sentCount: number;
  acceptedCount: number;
  acceptedNotConvertedCount: number;
  expiredCount: number;
}

export interface DashboardInvoiceKpis {
  draftCount: number;
  openOrSentCount: number;
  overdueCount: number;
  paidCount: number;
  partiallyPaidCount: number;
}

export interface TrendPoint {
  monthKey: string;
  label: string;
  invoicedMinor: number;
  paidMinor: number;
}

export interface OperationalActivityItem {
  id: string;
  timestamp: string;
  type: 'invoice_sent' | 'quote_sent' | 'payment' | 'email_failed' | 'pdf_generated' | 'email_sent';
  title: string;
  detail?: string;
}

export interface ClientInsightRow {
  clientId: string;
  clientName: string;
  invoiceValueMinor: number;
  outstandingMinor: number;
  overdueMinor: number;
  invoicesCount: number;
}

export interface DashboardInsights {
  financial: DashboardFinancialKpis;
  quotes: DashboardQuoteKpis;
  invoices: DashboardInvoiceKpis;
  trends: TrendPoint[];
  topClientsByInvoiceValue: ClientInsightRow[];
  topClientsByOutstanding: ClientInsightRow[];
  clientsWithOverdue: ClientInsightRow[];
  recentActivity: OperationalActivityItem[];
  recentPayments: Payment[];
  recentInvoiceSummaries: InvoiceSummary[];
  recentQuoteSummaries: QuoteSummary[];
  recentFailedEmails: EmailLogListRow[];
  recentPdfArchive: PdfArchiveListRow[];
}

export interface AgingBucket {
  label: 'Current' | '1-30' | '31-60' | '61-90' | '90+';
  count: number;
  outstandingMinor: number;
}

export interface InvoiceAgingSummary {
  buckets: AgingBucket[];
  totalOutstandingMinor: number;
}

export interface QuotesConversionSummary {
  totalQuotes: number;
  acceptedQuotes: number;
  rejectedQuotes: number;
  expiredQuotes: number;
  convertedQuotes: number;
  acceptedNotConvertedCount: number;
  acceptedNotConvertedValueMinor: number;
  conversionRatePercent: number;
}

export interface MonthlySalesSummary {
  invoicesCount: number;
  totalInvoicedMinor: number;
  totalPaidMinor: number;
  totalOutstandingMinor: number;
  averageInvoiceValueMinor: number;
}

export interface PaymentsSummary {
  paymentsCount: number;
  totalPaidMinor: number;
  monthlyTotals: TrendPoint[];
  topPayingClients: Array<{
    clientId: string;
    clientName: string;
    paidMinor: number;
  }>;
}

export interface EmailActivitySummary {
  totalSends: number;
  successfulSends: number;
  failedSends: number;
  quoteSends: number;
  invoiceSends: number;
  recentFailures: EmailLogListRow[];
}

export interface PdfArchiveSummary {
  totalGenerated: number;
  quotePdfs: number;
  invoicePdfs: number;
  immutableCount: number;
  recent: PdfArchiveListRow[];
}

export interface ReportsSummary {
  invoiceAging: InvoiceAgingSummary;
  quoteConversion: QuotesConversionSummary;
  monthlySales: MonthlySalesSummary;
  payments: PaymentsSummary;
  emailActivity: EmailActivitySummary;
  pdfArchive: PdfArchiveSummary;
}
