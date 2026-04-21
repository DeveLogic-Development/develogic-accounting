import { Invoice, Quote } from './types';

export function convertQuoteToInvoice(input: {
  quote: Quote;
  invoiceId: string;
  invoiceNumber: string;
  nowIso: string;
  dueDate: string;
  options?: {
    carryCustomerNotes?: boolean;
    carryTermsAndConditions?: boolean;
    carryAddresses?: boolean;
  };
}): Invoice {
  const { quote, invoiceId, invoiceNumber, nowIso, dueDate, options } = input;
  const carryCustomerNotes = options?.carryCustomerNotes ?? true;
  const carryTermsAndConditions = options?.carryTermsAndConditions ?? true;
  const carryAddresses = options?.carryAddresses ?? true;

  return {
    id: invoiceId,
    invoiceNumber,
    orderNumber: quote.referenceNumber,
    accountsReceivableAccountId: undefined,
    salesperson: quote.salesperson,
    subject: quote.subject,
    clientId: quote.clientId,
    issueDate: quote.issueDate,
    dueDate,
    terms: 'custom',
    currencyCode: quote.currencyCode,
    status: 'approved',
    templateId: quote.templateId,
    templateVersionId: quote.templateVersionId,
    templateName: quote.templateName,
    notes: carryCustomerNotes ? quote.notes : '',
    paymentTerms: carryTermsAndConditions
      ? quote.termsAndConditions ?? quote.paymentTerms
      : '',
    termsAndConditions: carryTermsAndConditions
      ? quote.termsAndConditions ?? quote.paymentTerms
      : '',
    internalMemo: quote.internalMemo,
    recipientEmails: quote.recipientEmails ?? [],
    billingAddressSnapshot: carryAddresses ? quote.billingAddressSnapshot : undefined,
    shippingAddressSnapshot: carryAddresses ? quote.shippingAddressSnapshot : undefined,
    attachments: [],
    activityLog: [
      {
        id: `${invoiceId}_evt_1`,
        event: 'created',
        at: nowIso,
        message: `Invoice created from ${quote.quoteNumber}.`,
      },
    ],
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
        note: `Converted from quote ${quote.quoteNumber}${carryAddresses ? '' : ' (address snapshots excluded)'}`,
      },
    ],
  };
}
