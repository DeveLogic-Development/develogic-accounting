import { AccountingState, InvoiceSummary } from '@/modules/accounting/domain/types';
import { MasterClient } from '@/modules/master-data/domain/types';
import { EmailLogRecord } from '@/modules/emails/domain/types';

export interface CustomerTransactionRow {
  id: string;
  date: string;
  kind: 'invoice' | 'payment' | 'quote';
  reference: string;
  status?: string;
  amountMinor: number;
  balanceMinor?: number;
  route: string;
}

export interface CustomerStatementRow {
  id: string;
  date: string;
  reference: string;
  type: 'opening_balance' | 'invoice' | 'payment';
  debitMinor: number;
  creditMinor: number;
  runningBalanceMinor: number;
}

export interface CustomerStatementSummary {
  openingBalanceMinor: number;
  invoicedMinor: number;
  paymentsMinor: number;
  balanceDueMinor: number;
}

function asSafeDate(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asSafeId(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function getCustomerReceivables(
  clientId: string,
  invoiceSummaries: InvoiceSummary[],
): number {
  return invoiceSummaries
    .filter((invoice) => invoice.clientId === clientId)
    .reduce((sum, invoice) => sum + invoice.outstandingMinor, 0);
}

export function buildCustomerTransactions(
  clientId: string,
  accounting: AccountingState,
  invoiceSummaries: InvoiceSummary[],
): CustomerTransactionRow[] {
  const invoiceSummaryById = new Map(
    invoiceSummaries.map((summary) => [summary.id, summary]),
  );

  const invoiceRows: CustomerTransactionRow[] = accounting.invoices
    .filter((invoice) => invoice.clientId === clientId)
    .map((invoice) => {
      const summary = invoiceSummaryById.get(invoice.id);
      return {
        id: `invoice_${asSafeId(invoice.id, 'unknown')}`,
        date: asSafeDate(invoice.issueDate),
        kind: 'invoice' as const,
        reference: invoice.invoiceNumber || asSafeId(invoice.id, 'Invoice'),
        status: invoice.status,
        amountMinor: summary?.totalMinor ?? 0,
        balanceMinor: summary?.outstandingMinor ?? 0,
        route: `/invoices/${asSafeId(invoice.id, '')}`,
      };
    });

  const paymentRows: CustomerTransactionRow[] = accounting.payments
    .filter((payment) => {
      const invoice = accounting.invoices.find((candidate) => candidate.id === payment.invoiceId);
      return invoice?.clientId === clientId;
    })
    .map((payment) => ({
      id: `payment_${asSafeId(payment.id, 'unknown')}`,
      date: asSafeDate(payment.paymentDate),
      kind: 'payment' as const,
      reference: payment.reference || asSafeId(payment.id, 'Payment'),
      status: payment.method || 'received',
      amountMinor: payment.amountMinor,
      route: `/invoices/${asSafeId(payment.invoiceId, '')}`,
    }));

  const quoteRows: CustomerTransactionRow[] = accounting.quotes
    .filter((quote) => quote.clientId === clientId)
    .map((quote) => ({
      id: `quote_${asSafeId(quote.id, 'unknown')}`,
      date: asSafeDate(quote.issueDate),
      kind: 'quote' as const,
      reference: quote.quoteNumber || asSafeId(quote.id, 'Quote'),
      status: quote.status,
      amountMinor: 0,
      route: `/quotes/${asSafeId(quote.id, '')}`,
    }));

  return [...invoiceRows, ...paymentRows, ...quoteRows]
    .filter((entry) => entry.date.length > 0)
    .sort((a, b) =>
    b.date.localeCompare(a.date),
    );
}

export function filterCustomerMails(
  clientId: string,
  logs: EmailLogRecord[],
): EmailLogRecord[] {
  return logs
    .filter((log) => log.document.clientId === clientId)
    .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt));
}

export function buildCustomerStatement(params: {
  client: MasterClient;
  accounting: AccountingState;
  invoiceSummaries: InvoiceSummary[];
  fromDate?: string;
  toDate?: string;
}): { rows: CustomerStatementRow[]; summary: CustomerStatementSummary } {
  const { client, accounting, invoiceSummaries, fromDate, toDate } = params;
  const inRange = (date: string) => {
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  };

  const openingBalanceMinor = Math.round((client.openingBalance ?? 0) * 100);
  const rows: CustomerStatementRow[] = [];
  const baseDate = asSafeDate(client.createdAt, new Date().toISOString().slice(0, 10));

  rows.push({
    id: `${client.id}_opening`,
    date: fromDate || baseDate.slice(0, 10),
    reference: 'Opening Balance',
    type: 'opening_balance',
    debitMinor: openingBalanceMinor,
    creditMinor: 0,
    runningBalanceMinor: openingBalanceMinor,
  });

  const customerInvoices = accounting.invoices
    .filter((invoice) => invoice.clientId === client.id && inRange(invoice.issueDate))
    .map((invoice) => {
      const summary = invoiceSummaries.find((entry) => entry.id === invoice.id);
      return {
        id: asSafeId(invoice.id, 'unknown'),
        date: asSafeDate(invoice.issueDate),
        reference: invoice.invoiceNumber || asSafeId(invoice.id, 'Invoice'),
        amountMinor: summary?.totalMinor ?? 0,
      };
    });

  const customerPayments = accounting.payments
    .filter((payment) => {
      if (!inRange(payment.paymentDate)) return false;
      const invoice = accounting.invoices.find((candidate) => candidate.id === payment.invoiceId);
      return invoice?.clientId === client.id;
    })
    .map((payment) => ({
      id: asSafeId(payment.id, 'unknown'),
      date: asSafeDate(payment.paymentDate),
      reference:
        payment.reference ||
        `Payment ${asSafeId(payment.id, 'unknown').slice(0, 8)}`,
      amountMinor: payment.amountMinor,
    }));

  const combined = [
    ...customerInvoices.map((invoice) => ({
      id: `invoice_${invoice.id}`,
      date: invoice.date,
      reference: invoice.reference,
      type: 'invoice' as const,
      debitMinor: invoice.amountMinor,
      creditMinor: 0,
    })),
    ...customerPayments.map((payment) => ({
      id: `payment_${payment.id}`,
      date: payment.date,
      reference: payment.reference,
      type: 'payment' as const,
      debitMinor: 0,
      creditMinor: payment.amountMinor,
    })),
  ]
    .filter((entry) => entry.date.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  let runningBalanceMinor = openingBalanceMinor;
  combined.forEach((entry) => {
    runningBalanceMinor += entry.debitMinor - entry.creditMinor;
    rows.push({
      ...entry,
      runningBalanceMinor,
    });
  });

  const invoicedMinor = customerInvoices.reduce((sum, invoice) => sum + invoice.amountMinor, 0);
  const paymentsMinor = customerPayments.reduce((sum, payment) => sum + payment.amountMinor, 0);

  return {
    rows,
    summary: {
      openingBalanceMinor,
      invoicedMinor,
      paymentsMinor,
      balanceDueMinor: openingBalanceMinor + invoicedMinor - paymentsMinor,
    },
  };
}
