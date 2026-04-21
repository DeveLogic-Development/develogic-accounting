import { AccountingState, Invoice, InvoiceSummary, Quote, QuoteSummary } from './types';
import { calculateDocumentTotals, deriveInvoicePaymentSummary } from './calculations';

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
      const totals = calculateDocumentTotals(invoice.items, invoice.documentDiscountPercent);
      const payment = deriveInvoicePaymentSummary(invoice, state.payments, nowIso);

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        status: payment.derivedStatus,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        totalMinor: totals.totalMinor,
        paidMinor: payment.paidMinor,
        outstandingMinor: payment.outstandingMinor,
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
