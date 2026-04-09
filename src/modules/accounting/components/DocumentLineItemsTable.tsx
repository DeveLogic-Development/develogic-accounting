import { formatMinorCurrency } from '@/utils/format';
import { BaseDocumentItem } from '../domain/types';
import { multiplyQuantityByUnitPriceMinor, percentageOfMinor } from '../domain/money';

interface DocumentLineItemsTableProps {
  items: BaseDocumentItem[];
  currencyCode?: string;
}

export function DocumentLineItemsTable({ items, currencyCode = 'ZAR' }: DocumentLineItemsTableProps) {
  return (
    <div className="dl-line-editor">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Disc%</th>
            <th>Tax%</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((item) => {
              const subtotalMinor = multiplyQuantityByUnitPriceMinor(item.quantity, item.unitPriceMinor);
              const lineDiscountMinor = percentageOfMinor(subtotalMinor, item.discountPercent);
              const taxableMinor = Math.max(0, subtotalMinor - lineDiscountMinor);
              const taxMinor = percentageOfMinor(taxableMinor, item.taxRatePercent);
              const totalMinor = taxableMinor + taxMinor;

              return (
                <tr key={item.id}>
                  <td>
                    <strong>{item.itemName}</strong>
                    <div className="dl-muted">{item.description || 'No description'}</div>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatMinorCurrency(item.unitPriceMinor, currencyCode)}</td>
                  <td>{item.discountPercent.toFixed(2)}%</td>
                  <td>{item.taxRatePercent.toFixed(2)}%</td>
                  <td>{formatMinorCurrency(totalMinor, currencyCode)}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
