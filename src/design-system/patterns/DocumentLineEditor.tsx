import { DocumentLineItem } from '@/types/domain';
import { formatCurrency } from '@/utils/format';

interface DocumentLineEditorProps {
  items: DocumentLineItem[];
}

function calcLineTotal(item: DocumentLineItem): number {
  const subtotal = item.quantity * item.unitPrice;
  const discount = subtotal * (item.discountPercent / 100);
  const taxable = subtotal - discount;
  const tax = taxable * (item.taxRate / 100);
  return taxable + tax;
}

export function DocumentLineEditor({ items }: DocumentLineEditorProps) {
  return (
    <div className="dl-line-editor">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Tax</th>
            <th>Disc.</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.itemName}</strong>
                <div className="dl-muted">{item.description}</div>
              </td>
              <td>{item.quantity}</td>
              <td>{formatCurrency(item.unitPrice)}</td>
              <td>{item.taxRate}%</td>
              <td>{item.discountPercent}%</td>
              <td>{formatCurrency(calcLineTotal(item))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
