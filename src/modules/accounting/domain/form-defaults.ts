import { addDaysIsoDate, todayIsoDate } from './date';
import { createId } from './id';
import {
  InvoiceFormValues,
  InvoiceItemFormValues,
  QuoteFormValues,
  QuoteItemFormValues,
} from './types';

const DEFAULT_TAX_RATE = 15;

export function createEmptyLineItem(position: number): QuoteItemFormValues {
  return {
    id: createId('line'),
    productServiceId: undefined,
    itemName: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
    taxRatePercent: DEFAULT_TAX_RATE,
    position,
  };
}

export function createDefaultQuoteFormValues(): QuoteFormValues {
  const issueDate = todayIsoDate();
  return {
    quoteNumber: undefined,
    referenceNumber: '',
    salesperson: '',
    projectName: '',
    subject: '',
    clientId: '',
    issueDate,
    expiryDate: addDaysIsoDate(issueDate, 14),
    templateId: undefined,
    templateVersionId: undefined,
    templateName: 'Modern Quote',
    notes: 'Thank you for the opportunity. This quote is valid for 14 days.',
    termsAndConditions: '',
    paymentTerms: 'Payment due within 14 days.',
    internalMemo: '',
    adjustment: 0,
    recipientEmails: [],
    billingAddressSnapshot: undefined,
    shippingAddressSnapshot: undefined,
    attachments: [],
    documentDiscountPercent: 0,
    items: [createEmptyLineItem(1)],
  };
}

export function createDefaultInvoiceFormValues(): InvoiceFormValues {
  const issueDate = todayIsoDate();
  return {
    invoiceNumber: undefined,
    orderNumber: '',
    accountsReceivableAccountId: 'accounts_receivable',
    salesperson: '',
    subject: '',
    clientId: '',
    issueDate,
    terms: 'due_on_receipt',
    dueDate: issueDate,
    templateId: undefined,
    templateVersionId: undefined,
    templateName: 'Modern Invoice',
    notes: 'Thanks for your business.',
    paymentTerms: 'Due on receipt',
    termsAndConditions: '',
    internalMemo: '',
    adjustment: 0,
    recipientEmails: [],
    billingAddressSnapshot: undefined,
    shippingAddressSnapshot: undefined,
    attachments: [],
    documentDiscountPercent: 0,
    items: [createEmptyLineItem(1) as InvoiceItemFormValues],
  };
}
