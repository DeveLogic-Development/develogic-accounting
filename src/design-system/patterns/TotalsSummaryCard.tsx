import { Card } from '@/design-system/primitives/Card';
import { DocumentLineItem } from '@/types/domain';
import { formatCurrency } from '@/utils/format';

interface TotalsSummaryCardProps {
  items: DocumentLineItem[];
}

export function TotalsSummaryCard({ items }: TotalsSummaryCardProps) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (item.discountPercent / 100),
    0,
  );
  const taxable = subtotal - discount;
  const tax = items.reduce(
    (sum, item) =>
      sum +
      (item.quantity * item.unitPrice - item.quantity * item.unitPrice * (item.discountPercent / 100)) *
        (item.taxRate / 100),
    0,
  );
  const total = taxable + tax;

  return (
    <Card title="Totals Summary" subtitle="Draft calculation preview">
      <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="dl-muted">Subtotal</span>
          <strong>{formatCurrency(subtotal)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="dl-muted">Discount</span>
          <strong>- {formatCurrency(discount)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="dl-muted">Tax</span>
          <strong>{formatCurrency(tax)}</strong>
        </div>
        <div className="dl-divider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
          <span>Total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </div>
    </Card>
  );
}
