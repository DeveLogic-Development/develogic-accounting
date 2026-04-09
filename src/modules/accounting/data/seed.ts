import { invoices as invoiceMocks, quoteLineItems, quotes as quoteMocks } from '@/mocks/data';
import { addDaysIsoDate, todayIsoDate } from '../domain/date';
import { createId } from '../domain/id';
import { toMinor } from '../domain/money';
import { AccountingState, Invoice, Payment, Quote } from '../domain/types';
import { deriveInvoicePaymentSummary } from '../domain/calculations';

function parseSequenceNumber(value: string): number {
  const match = value.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function buildQuoteItems(ownerId: string) {
  return quoteLineItems.map((item, index) => ({
    id: `${ownerId}_item_${index + 1}`,
    itemName: item.itemName,
    description: item.description,
    quantity: item.quantity,
    unitPriceMinor: toMinor(item.unitPrice),
    discountPercent: item.discountPercent,
    taxRatePercent: item.taxRate,
    position: index + 1,
  }));
}

const DEFAULT_QUOTE_TEMPLATE_ID = 'tpl_preset_modern_minimal';
const DEFAULT_QUOTE_TEMPLATE_VERSION_ID = 'tpl_preset_modern_minimal_v1';
const DEFAULT_INVOICE_TEMPLATE_ID = 'tpl_preset_corporate_clean';
const DEFAULT_INVOICE_TEMPLATE_VERSION_ID = 'tpl_preset_corporate_clean_v1';

export function createSeedState(): AccountingState {
  const nowIso = new Date().toISOString();

  const quotes: Quote[] = quoteMocks.map((mock) => {
    const id = mock.id;
    return {
      id,
      quoteNumber: mock.quoteNumber,
      clientId: mock.clientId,
      issueDate: mock.issueDate,
      expiryDate: mock.validUntil,
      currencyCode: 'ZAR',
      status: mock.status === 'declined' ? 'rejected' : mock.status,
      templateId: DEFAULT_QUOTE_TEMPLATE_ID,
      templateVersionId: DEFAULT_QUOTE_TEMPLATE_VERSION_ID,
      templateName: 'Modern Minimal',
      notes: '',
      paymentTerms: 'Payment due within 14 days.',
      internalMemo: '',
      items: buildQuoteItems(id),
      documentDiscountPercent: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusHistory: [
        {
          id: `${id}_status_1`,
          status: mock.status === 'declined' ? 'rejected' : mock.status,
          at: nowIso,
        },
      ],
    };
  });

  const payments: Payment[] = [];

  const invoices: Invoice[] = invoiceMocks.map((mock) => {
    const id = mock.id;
    const invoice: Invoice = {
      id,
      invoiceNumber: mock.invoiceNumber,
      clientId: mock.clientId,
      issueDate: mock.issueDate,
      dueDate: mock.dueDate,
      currencyCode: 'ZAR',
      status: mock.status === 'issued' ? 'approved' : mock.status,
      templateId: DEFAULT_INVOICE_TEMPLATE_ID,
      templateVersionId: DEFAULT_INVOICE_TEMPLATE_VERSION_ID,
      templateName: 'Corporate Clean',
      notes: '',
      paymentTerms: 'Payment due within 14 days.',
      internalMemo: '',
      items: buildQuoteItems(id),
      documentDiscountPercent: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusHistory: [
        {
          id: `${id}_status_1`,
          status: mock.status === 'issued' ? 'approved' : mock.status,
          at: nowIso,
        },
      ],
      sentAt: mock.status === 'sent' ? nowIso : undefined,
    };

    const totalMinor = toMinor(mock.total);
    const outstandingMinor = toMinor(mock.balanceDue);
    const paidMinor = Math.max(0, totalMinor - outstandingMinor);

    if (paidMinor > 0) {
      payments.push({
        id: createId('pay_seed'),
        invoiceId: id,
        amountMinor: paidMinor,
        paymentDate: addDaysIsoDate(mock.issueDate, 3),
        method: 'bank_transfer',
        reference: `SEED-${mock.invoiceNumber}`,
        note: 'Seeded historical payment',
        createdAt: nowIso,
      });
    }

    const paymentSummary = deriveInvoicePaymentSummary(invoice, payments, new Date(`${todayIsoDate()}T00:00:00.000Z`).toISOString());
    invoice.status = paymentSummary.derivedStatus;

    return invoice;
  });

  const quoteSequenceNext =
    Math.max(0, ...quotes.map((quote) => parseSequenceNumber(quote.quoteNumber))) + 1;
  const invoiceSequenceNext =
    Math.max(0, ...invoices.map((invoice) => parseSequenceNumber(invoice.invoiceNumber))) + 1;

  return {
    quotes,
    invoices,
    payments,
    quoteSequenceNext,
    invoiceSequenceNext,
  };
}
