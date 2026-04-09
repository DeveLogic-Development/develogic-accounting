import { Card } from '@/design-system/primitives/Card';
import { formatMinorCurrency } from '@/utils/format';
import { calculateDocumentTotals } from '../domain/calculations';
import { toMinor } from '../domain/money';
import { LineItemValue } from './LineItemsEditor';

interface DocumentTotalsPanelProps {
  items: LineItemValue[];
  documentDiscountPercent: number;
  currencyCode?: string;
  paidMinor?: number;
}

export function DocumentTotalsPanel({
  items,
  documentDiscountPercent,
  currencyCode = 'ZAR',
  paidMinor,
}: DocumentTotalsPanelProps) {
  const totals = calculateDocumentTotals(
    items.map((item, index) => ({
      id: item.id,
      itemName: item.itemName,
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: toMinor(item.unitPrice),
      discountPercent: item.discountPercent,
      taxRatePercent: item.taxRatePercent,
      position: index + 1,
    })),
    documentDiscountPercent,
  );

  const outstandingMinor = typeof paidMinor === 'number' ? Math.max(0, totals.totalMinor - paidMinor) : undefined;

  return (
    <Card title="Totals" subtitle="Calculated from line items and document discount">
      <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
        <Row label="Subtotal" value={formatMinorCurrency(totals.subtotalMinor, currencyCode)} />
        <Row
          label="Line Discounts"
          value={`- ${formatMinorCurrency(totals.lineDiscountMinor, currencyCode)}`}
        />
        <Row
          label="Document Discount"
          value={`- ${formatMinorCurrency(totals.documentDiscountMinor, currencyCode)}`}
          muted={documentDiscountPercent <= 0}
        />
        <Row label="Tax" value={formatMinorCurrency(totals.taxMinor, currencyCode)} />
        <div className="dl-divider" style={{ margin: '6px 0' }} />
        <Row
          label="Total"
          value={formatMinorCurrency(totals.totalMinor, currencyCode)}
          strong
        />

        {typeof paidMinor === 'number' ? (
          <>
            <Row label="Paid" value={formatMinorCurrency(paidMinor, currencyCode)} />
            <Row
              label="Outstanding"
              value={formatMinorCurrency(outstandingMinor ?? 0, currencyCode)}
              strong
            />
          </>
        ) : null}
      </div>
    </Card>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span className={muted ? 'dl-muted' : undefined}>{label}</span>
      <strong style={strong ? { fontSize: 17 } : undefined}>{value}</strong>
    </div>
  );
}
