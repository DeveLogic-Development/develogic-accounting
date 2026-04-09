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
    clientId: quote.clientId,
    issueDate: quote.issueDate,
    expiryDate: quote.expiryDate,
    templateId: quote.templateId,
    templateVersionId: quote.templateVersionId,
    templateName: quote.templateName,
    notes: quote.notes,
    paymentTerms: quote.paymentTerms,
    internalMemo: quote.internalMemo,
    documentDiscountPercent: quote.documentDiscountPercent,
    items: quote.items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(mapQuoteItemToFormValues),
  };
}

export function mapInvoiceToFormValues(invoice: Invoice): InvoiceFormValues {
  return {
    clientId: invoice.clientId,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    templateId: invoice.templateId,
    templateVersionId: invoice.templateVersionId,
    templateName: invoice.templateName,
    notes: invoice.notes,
    paymentTerms: invoice.paymentTerms,
    internalMemo: invoice.internalMemo,
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
    itemName: item.itemName,
    description: item.description,
    quantity: item.quantity,
    unitPrice: fromMinor(item.unitPriceMinor),
    discountPercent: item.discountPercent,
    taxRatePercent: item.taxRatePercent,
    position: item.position,
  };
}
