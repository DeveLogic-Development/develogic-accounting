import {
  Invoice,
  InvoiceFormValues,
  InvoiceItem,
  InvoiceItemFormValues,
  Quote,
  QuoteFormValues,
  QuoteItem,
  QuoteItemFormValues,
} from './types';
import { fromMinor, toMinor } from './money';

export function mapQuoteToFormValues(quote: Quote): QuoteFormValues {
  return {
    quoteNumber: quote.quoteNumber,
    referenceNumber: quote.referenceNumber ?? '',
    salesperson: quote.salesperson ?? '',
    projectName: quote.projectName ?? '',
    subject: quote.subject ?? '',
    clientId: quote.clientId,
    issueDate: quote.issueDate,
    expiryDate: quote.expiryDate,
    templateId: quote.templateId,
    templateVersionId: quote.templateVersionId,
    templateName: quote.templateName,
    notes: quote.notes,
    termsAndConditions: quote.termsAndConditions ?? quote.paymentTerms,
    paymentTerms: quote.paymentTerms,
    internalMemo: quote.internalMemo,
    adjustment: (quote.adjustmentMinor ?? 0) / 100,
    recipientEmails: quote.recipientEmails ?? [],
    billingAddressSnapshot: quote.billingAddressSnapshot,
    shippingAddressSnapshot: quote.shippingAddressSnapshot,
    attachments: quote.attachments ?? [],
    documentDiscountPercent: quote.documentDiscountPercent,
    items: quote.items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(mapQuoteItemToFormValues),
  };
}

export function mapInvoiceToFormValues(invoice: Invoice): InvoiceFormValues {
  return {
    invoiceNumber: invoice.invoiceNumber,
    orderNumber: invoice.orderNumber ?? '',
    accountsReceivableAccountId: invoice.accountsReceivableAccountId ?? '',
    salesperson: invoice.salesperson ?? '',
    subject: invoice.subject ?? '',
    clientId: invoice.clientId,
    issueDate: invoice.issueDate,
    terms: invoice.terms || 'custom',
    dueDate: invoice.dueDate,
    templateId: invoice.templateId,
    templateVersionId: invoice.templateVersionId,
    templateName: invoice.templateName,
    notes: invoice.notes,
    paymentTerms: invoice.paymentTerms || invoice.terms,
    termsAndConditions: invoice.termsAndConditions ?? invoice.paymentTerms,
    internalMemo: invoice.internalMemo,
    adjustment: (invoice.adjustmentMinor ?? 0) / 100,
    recipientEmails: invoice.recipientEmails ?? [],
    billingAddressSnapshot: invoice.billingAddressSnapshot,
    shippingAddressSnapshot: invoice.shippingAddressSnapshot,
    attachments: invoice.attachments ?? [],
    documentDiscountPercent: invoice.documentDiscountPercent,
    items: invoice.items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(mapInvoiceItemToFormValues),
  };
}

export function mapQuoteItemsFormToDomain(items: QuoteItemFormValues[]): QuoteItem[] {
  return items.map((item, index) => ({
    id: item.id,
    productServiceId: item.productServiceId,
    itemName: item.itemName,
    description: item.description,
    quantity: item.quantity,
    unitPriceMinor: toMinor(item.unitPrice),
    discountPercent: item.discountPercent,
    taxRatePercent: item.taxRatePercent,
    position: index + 1,
  }));
}

export function mapInvoiceItemsFormToDomain(items: InvoiceItemFormValues[]): InvoiceItem[] {
  return items.map((item, index) => ({
    id: item.id,
    productServiceId: item.productServiceId,
    itemName: item.itemName,
    description: item.description,
    quantity: item.quantity,
    unitPriceMinor: toMinor(item.unitPrice),
    discountPercent: item.discountPercent,
    taxRatePercent: item.taxRatePercent,
    position: index + 1,
  }));
}

function mapQuoteItemToFormValues(item: QuoteItem): QuoteItemFormValues {
  return {
    id: item.id,
    productServiceId: item.productServiceId,
    itemName: item.itemName,
    description: item.description,
    quantity: item.quantity,
    unitPrice: fromMinor(item.unitPriceMinor),
    discountPercent: item.discountPercent,
    taxRatePercent: item.taxRatePercent,
    position: item.position,
  };
}

function mapInvoiceItemToFormValues(item: InvoiceItem): InvoiceItemFormValues {
  return {
    id: item.id,
    productServiceId: item.productServiceId,
    itemName: item.itemName,
    description: item.description,
    quantity: item.quantity,
    unitPrice: fromMinor(item.unitPriceMinor),
    discountPercent: item.discountPercent,
    taxRatePercent: item.taxRatePercent,
    position: item.position,
  };
}
