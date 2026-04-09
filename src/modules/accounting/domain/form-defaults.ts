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
    clientId: '',
    issueDate,
    expiryDate: addDaysIsoDate(issueDate, 14),
    templateId: undefined,
    templateVersionId: undefined,
    templateName: 'Modern Quote',
    notes: 'Thank you for the opportunity. This quote is valid for 14 days.',
    paymentTerms: 'Payment due within 14 days.',
    internalMemo: '',
    documentDiscountPercent: 0,
    items: [createEmptyLineItem(1)],
  };
}

export function createDefaultInvoiceFormValues(): InvoiceFormValues {
  const issueDate = todayIsoDate();
  return {
    clientId: '',
    issueDate,
    dueDate: addDaysIsoDate(issueDate, 14),
    templateId: undefined,
    templateVersionId: undefined,
    templateName: 'Modern Invoice',
    notes: '',
    paymentTerms: 'Payment due within 14 days of invoice date.',
    internalMemo: '',
    documentDiscountPercent: 0,
    items: [createEmptyLineItem(1) as InvoiceItemFormValues],
  };
}
