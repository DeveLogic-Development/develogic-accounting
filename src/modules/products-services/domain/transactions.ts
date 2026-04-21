import { AccountingState } from '@/modules/accounting/domain/types';
import { MasterClient, MasterProductService } from '@/modules/master-data/domain/types';
import { multiplyQuantityByUnitPriceMinor, percentageOfMinor } from '@/modules/accounting/domain/money';

export type ItemTransactionKind = 'quote' | 'invoice';

export interface ItemTransactionRow {
  id: string;
  kind: ItemTransactionKind;
  documentId: string;
  documentNumber: string;
  date: string;
  clientId: string;
  clientName: string;
  status: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  route: string;
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function calculateLineTotalMinor(input: {
  quantity: number;
  unitPriceMinor: number;
  discountPercent: number;
  taxRatePercent: number;
}): number {
  const subtotalMinor = multiplyQuantityByUnitPriceMinor(input.quantity, input.unitPriceMinor);
  const discountMinor = percentageOfMinor(subtotalMinor, input.discountPercent);
  const taxableMinor = Math.max(0, subtotalMinor - discountMinor);
  const taxMinor = percentageOfMinor(taxableMinor, input.taxRatePercent);
  return taxableMinor + taxMinor;
}

function matchesItem(args: {
  item: MasterProductService;
  itemName: string;
  productServiceId?: string;
}): boolean {
  if (args.productServiceId && args.productServiceId === args.item.id) return true;
  return normalizeText(args.itemName) === normalizeText(args.item.name);
}

export function buildItemTransactions(args: {
  item: MasterProductService;
  accounting: AccountingState;
  clients: MasterClient[];
}): ItemTransactionRow[] {
  const { item, accounting, clients } = args;
  const clientNameById = new Map(clients.map((client) => [client.id, client.displayName]));

  const quoteRows: ItemTransactionRow[] = accounting.quotes.flatMap((quote) =>
    quote.items
      .filter((line) => matchesItem({ item, itemName: line.itemName, productServiceId: line.productServiceId }))
      .map((line) => ({
        id: `quote_${quote.id}_${line.id}`,
        kind: 'quote' as const,
        documentId: quote.id,
        documentNumber: quote.quoteNumber,
        date: quote.issueDate,
        clientId: quote.clientId,
        clientName: clientNameById.get(quote.clientId) ?? 'Unknown client',
        status: quote.status,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        lineTotalMinor: calculateLineTotalMinor({
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
          discountPercent: line.discountPercent,
          taxRatePercent: line.taxRatePercent,
        }),
        route: `/quotes/${quote.id}`,
      })),
  );

  const invoiceRows: ItemTransactionRow[] = accounting.invoices.flatMap((invoice) =>
    invoice.items
      .filter((line) => matchesItem({ item, itemName: line.itemName, productServiceId: line.productServiceId }))
      .map((line) => ({
        id: `invoice_${invoice.id}_${line.id}`,
        kind: 'invoice' as const,
        documentId: invoice.id,
        documentNumber: invoice.invoiceNumber,
        date: invoice.issueDate,
        clientId: invoice.clientId,
        clientName: clientNameById.get(invoice.clientId) ?? 'Unknown client',
        status: invoice.status,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        lineTotalMinor: calculateLineTotalMinor({
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
          discountPercent: line.discountPercent,
          taxRatePercent: line.taxRatePercent,
        }),
        route: `/invoices/${invoice.id}`,
      })),
  );

  return [...quoteRows, ...invoiceRows].sort((a, b) => b.date.localeCompare(a.date));
}
