import { BaseDocumentItem, DocumentPaymentSummary, DocumentTotals, Invoice, Payment } from './types';
import { clampMinor, percentageOfMinor, multiplyQuantityByUnitPriceMinor } from './money';

export function calculateDocumentTotals(
  items: BaseDocumentItem[],
  documentDiscountPercent = 0,
  adjustmentMinor = 0,
): DocumentTotals {
  const lineBreakdown = items
    .filter((item) => item.quantity > 0 && item.unitPriceMinor >= 0)
    .map((item) => {
      const lineSubtotalMinor = multiplyQuantityByUnitPriceMinor(item.quantity, item.unitPriceMinor);
      const lineDiscountMinor = percentageOfMinor(lineSubtotalMinor, item.discountPercent);
      const taxableMinor = clampMinor(lineSubtotalMinor - lineDiscountMinor);
      return {
        item,
        lineSubtotalMinor,
        lineDiscountMinor,
        taxableMinor,
      };
    });

  const subtotalMinor = lineBreakdown.reduce((sum, line) => sum + line.lineSubtotalMinor, 0);
  const lineDiscountMinor = lineBreakdown.reduce((sum, line) => sum + line.lineDiscountMinor, 0);
  const taxableBeforeDocDiscountMinor = clampMinor(subtotalMinor - lineDiscountMinor);
  const documentDiscountMinor = percentageOfMinor(taxableBeforeDocDiscountMinor, documentDiscountPercent);
  const taxableAfterDocDiscountMinor = clampMinor(taxableBeforeDocDiscountMinor - documentDiscountMinor);

  const taxMinor = calculateTaxWithProportionalDocumentDiscount(
    lineBreakdown.map((line) => ({ taxableMinor: line.taxableMinor, taxRatePercent: line.item.taxRatePercent })),
    documentDiscountMinor,
  );

  const normalizedAdjustmentMinor = Number.isFinite(adjustmentMinor)
    ? Math.round(adjustmentMinor)
    : 0;
  const totalMinor = clampMinor(taxableAfterDocDiscountMinor + taxMinor + normalizedAdjustmentMinor);

  return {
    subtotalMinor,
    lineDiscountMinor,
    documentDiscountMinor,
    adjustmentMinor: normalizedAdjustmentMinor,
    taxMinor,
    totalMinor,
  };
}

function calculateTaxWithProportionalDocumentDiscount(
  lines: Array<{ taxableMinor: number; taxRatePercent: number }>,
  documentDiscountMinor: number,
): number {
  const taxableTotal = lines.reduce((sum, line) => sum + line.taxableMinor, 0);

  if (taxableTotal <= 0) return 0;

  let remainingDiscount = documentDiscountMinor;
  let totalTax = 0;

  lines.forEach((line, index) => {
    const isLast = index === lines.length - 1;
    const lineShareDiscount = isLast
      ? remainingDiscount
      : Math.round((documentDiscountMinor * line.taxableMinor) / taxableTotal);

    remainingDiscount -= lineShareDiscount;

    const adjustedTaxable = clampMinor(line.taxableMinor - lineShareDiscount);
    totalTax += percentageOfMinor(adjustedTaxable, line.taxRatePercent);
  });

  return totalTax;
}

export function deriveInvoicePaymentSummary(
  invoice: Invoice,
  payments: Array<Pick<Payment, 'invoiceId' | 'amountMinor'>>,
  nowIso = new Date().toISOString(),
): DocumentPaymentSummary {
  const totals = calculateDocumentTotals(invoice.items, invoice.documentDiscountPercent, invoice.adjustmentMinor ?? 0);
  const paidMinor = payments
    .filter((payment) => payment.invoiceId === invoice.id)
    .reduce((sum, payment) => sum + payment.amountMinor, 0);

  const outstandingMinor = calculateOutstandingMinor(totals.totalMinor, paidMinor);

  const derivedStatus = deriveInvoiceStatus({
    currentStatus: invoice.status,
    dueDate: invoice.dueDate,
    outstandingMinor,
    paidMinor,
    nowIso,
  });

  return {
    paidMinor,
    outstandingMinor,
    derivedStatus,
  };
}

export function calculateOutstandingMinor(totalMinor: number, paidMinor: number): number {
  return clampMinor(totalMinor - paidMinor);
}

export function isInvoiceOverdue(dueDate: string, nowIso = new Date().toISOString()): boolean {
  const due = new Date(dueDate);
  const now = new Date(nowIso);
  if (!Number.isFinite(due.getTime()) || !Number.isFinite(now.getTime())) return false;
  return now > due;
}

export function deriveInvoiceStatus(input: {
  currentStatus: Invoice['status'];
  dueDate: string;
  outstandingMinor: number;
  paidMinor: number;
  nowIso: string;
}): Invoice['status'] {
  const { currentStatus, dueDate, outstandingMinor, paidMinor, nowIso } = input;

  if (currentStatus === 'void') return 'void';
  if (currentStatus === 'draft') return 'draft';

  if (outstandingMinor <= 0) return 'paid';

  if (isInvoiceOverdue(dueDate, nowIso)) {
    return 'overdue';
  }

  if (paidMinor > 0) return 'partially_paid';
  if (currentStatus === 'sent') return 'sent';

  return 'approved';
}
