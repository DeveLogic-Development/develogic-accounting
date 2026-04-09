import { Invoice, Quote } from './types';

export function convertQuoteToInvoice(input: {
  quote: Quote;
  invoiceId: string;
  invoiceNumber: string;
  nowIso: string;
  dueDate: string;
}): Invoice {
  const { quote, invoiceId, invoiceNumber, nowIso, dueDate } = input;

  return {
    id: invoiceId,
    invoiceNumber,
    clientId: quote.clientId,
    issueDate: quote.issueDate,
    dueDate,
    currencyCode: quote.currencyCode,
    status: 'approved',
    templateId: quote.templateId,
    templateVersionId: quote.templateVersionId,
    templateName: quote.templateName,
    notes: quote.notes,
    paymentTerms: quote.paymentTerms,
    internalMemo: quote.internalMemo,
    items: quote.items.map((item, index) => ({
      ...item,
      id: `${invoiceId}_item_${index + 1}`,
      position: index + 1,
    })),
    documentDiscountPercent: quote.documentDiscountPercent,
    sourceQuoteId: quote.id,
    createdAt: nowIso,
    updatedAt: nowIso,
    approvedAt: nowIso,
    statusHistory: [
      {
        id: `${invoiceId}_status_1`,
        status: 'approved',
        at: nowIso,
        note: `Converted from quote ${quote.quoteNumber}`,
      },
    ],
  };
}
