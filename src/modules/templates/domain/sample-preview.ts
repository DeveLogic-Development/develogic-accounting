import { calculateDocumentTotals } from '@/modules/accounting/domain/calculations';
import { toMinor } from '@/modules/accounting/domain/money';
import {
  buildPreviewPayloadFromInvoice,
  buildPreviewPayloadFromQuote,
  buildPreviewRowsFromDomainItems,
} from './preview-builders';
import { TemplatePreviewPayload } from './types';

const previewLineItems = [
  {
    itemName: 'Monthly Accounting Retainer',
    description: 'Monthly bookkeeping and finance reporting',
    quantity: 1,
    unitPrice: 18500,
    discountPercent: 0,
    taxRate: 15,
  },
  {
    itemName: 'Payroll Processing',
    description: 'Payroll processing for 35 employees',
    quantity: 1,
    unitPrice: 4200,
    discountPercent: 0,
    taxRate: 15,
  },
  {
    itemName: 'Advisory Strategy Session',
    description: 'Quarterly planning workshop',
    quantity: 1,
    unitPrice: 7500,
    discountPercent: 10,
    taxRate: 15,
  },
];

function makeDomainLineItems() {
  return previewLineItems.map((item, index) => ({
    id: `preview_item_${index + 1}`,
    itemName: item.itemName,
    description: item.description,
    quantity: item.quantity,
    unitPriceMinor: toMinor(item.unitPrice),
    discountPercent: item.discountPercent,
    taxRatePercent: item.taxRate,
    position: index + 1,
  }));
}

export function createQuoteTemplatePreviewPayload(): TemplatePreviewPayload {
  const items = makeDomainLineItems();
  const totals = calculateDocumentTotals(items, 0);

  return buildPreviewPayloadFromQuote({
    quoteNumber: 'QUO-PREVIEW-01',
    issueDate: '2026-04-09',
    expiryDate: '2026-04-23',
    lineItems: buildPreviewRowsFromDomainItems(items),
    totals,
    notes: 'This is a preview document rendered from the template config.',
    paymentTerms: 'Payment due within 14 days.',
    clientName: 'Nautilus Labs',
  });
}

export function createInvoiceTemplatePreviewPayload(): TemplatePreviewPayload {
  const items = makeDomainLineItems();
  const totals = calculateDocumentTotals(items, 0);
  const paidMinor = Math.round(totals.totalMinor * 0.4);

  return buildPreviewPayloadFromInvoice({
    invoiceNumber: 'INV-PREVIEW-01',
    issueDate: '2026-04-09',
    dueDate: '2026-04-23',
    lineItems: buildPreviewRowsFromDomainItems(items),
    totals,
    paidMinor,
    outstandingMinor: Math.max(0, totals.totalMinor - paidMinor),
    notes: 'Preview invoice generated from template config.',
    paymentTerms: 'Payment due within 14 days.',
    clientName: 'Silverstream Retail Group',
  });
}
