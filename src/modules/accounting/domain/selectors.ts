import { AccountingState, Invoice, InvoiceSummary, Quote, QuoteSummary } from './types';
import { calculateDocumentTotals, deriveInvoicePaymentSummary } from './calculations';
import { deriveInvoicePaymentSubmissionState } from './eft';

export function selectQuoteSummaries(state: AccountingState): QuoteSummary[] {
  return state.quotes
    .map((quote) => {
      const totals = calculateDocumentTotals(
        quote.items,
        quote.documentDiscountPercent,
        quote.adjustmentMinor ?? 0,
      );
      return {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        referenceNumber: quote.referenceNumber,
        clientId: quote.clientId,
        status: quote.status,
        issueDate: quote.issueDate,
        expiryDate: quote.expiryDate,
        totalMinor: totals.totalMinor,
      };
    })
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
}

export function selectInvoiceSummaries(state: AccountingState, nowIso = new Date().toISOString()): InvoiceSummary[] {
  return state.invoices
    .map((invoice) => {
      const totals = calculateDocumentTotals(
        invoice.items,
        invoice.documentDiscountPercent,
        invoice.adjustmentMinor ?? 0,
      );
      const payment = deriveInvoicePaymentSummary(invoice, state.payments, nowIso);
      const submissions = state.paymentSubmissions
        .filter((entry) => entry.invoiceId === invoice.id)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const pendingSubmissionCount = submissions.filter(
        (entry) => entry.status === 'submitted' || entry.status === 'under_review',
      ).length;
      const latestSubmissionAt = submissions[0]?.createdAt;

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        orderNumber: invoice.orderNumber,
        clientId: invoice.clientId,
        status: payment.derivedStatus,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        totalMinor: totals.totalMinor,
        paidMinor: payment.paidMinor,
        outstandingMinor: payment.outstandingMinor,
        terms: invoice.terms,
        salesperson: invoice.salesperson,
        paymentSubmissionState: deriveInvoicePaymentSubmissionState(submissions),
        pendingSubmissionCount,
        latestSubmissionAt,
      };
    })
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
}

export function selectQuoteById(state: AccountingState, quoteId: string): Quote | undefined {
  return state.quotes.find((quote) => quote.id === quoteId);
}

export function selectInvoiceById(state: AccountingState, invoiceId: string): Invoice | undefined {
  return state.invoices.find((invoice) => invoice.id === invoiceId);
}
