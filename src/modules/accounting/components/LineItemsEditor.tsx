import { Button } from '@/design-system/primitives/Button';
import { formatCurrency } from '@/utils/format';
import { multiplyQuantityByUnitPriceMinor, percentageOfMinor, toMinor } from '../domain/money';

export interface LineItemValue {
  id: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRatePercent: number;
  position: number;
}

interface LineItemsEditorProps<TItem extends LineItemValue> {
  items: TItem[];
  onChange: (items: TItem[]) => void;
  createItem: (position: number) => TItem;
  getFieldError?: (path: string) => string | undefined;
}

function normalizePositions<TItem extends LineItemValue>(items: TItem[]): TItem[] {
  return items.map((item, index) => ({
    ...item,
    position: index + 1,
  }));
}

function calculateLineTotalMajor(item: LineItemValue): number {
  const subtotalMinor = multiplyQuantityByUnitPriceMinor(item.quantity, toMinor(item.unitPrice));
  const lineDiscountMinor = percentageOfMinor(subtotalMinor, item.discountPercent);
  const taxableMinor = Math.max(0, subtotalMinor - lineDiscountMinor);
  const taxMinor = percentageOfMinor(taxableMinor, item.taxRatePercent);
  return (taxableMinor + taxMinor) / 100;
}

function safeNumericInput(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function LineItemsEditor<TItem extends LineItemValue>({
  items,
  onChange,
  createItem,
  getFieldError,
}: LineItemsEditorProps<TItem>) {
  const updateItem = <K extends keyof TItem>(index: number, key: K, value: TItem[K]) => {
    const next = items.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            [key]: value,
          }
        : item,
    );

    onChange(normalizePositions(next));
  };

  const addItem = () => {
    const next = [...items, createItem(items.length + 1)];
    onChange(normalizePositions(next));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(normalizePositions(items.filter((_, itemIndex) => itemIndex !== index)));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const next = items.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange(normalizePositions(next));
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="dl-line-editor">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>Item</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Disc. %</th>
              <th>Tax %</th>
              <th>Total</th>
              <th style={{ minWidth: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const base = `items.${index}`;
              return (
                <tr key={item.id}>
                  <td>
                    <input
                      className="dl-input"
                      placeholder="Item name"
                      value={item.itemName}
                      onChange={(event) => updateItem(index, 'itemName', event.target.value as TItem[keyof TItem])}
                    />
                    <textarea
                      className="dl-textarea"
                      style={{ minHeight: 64, marginTop: 8 }}
                      placeholder="Description"
                      value={item.description}
                      onChange={(event) =>
                        updateItem(index, 'description', event.target.value as TItem[keyof TItem])
                      }
                    />
                    {getFieldError?.(`${base}.itemName`) ? (
                      <div className="dl-field-error">{getFieldError(`${base}.itemName`)}</div>
                    ) : null}
                  </td>
                  <td>
                    <input
                      className="dl-input"
                      type="number"
                      step="0.01"
                      min={0}
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, 'quantity', safeNumericInput(event.target.value) as TItem[keyof TItem])
                      }
                    />
                    {getFieldError?.(`${base}.quantity`) ? (
                      <div className="dl-field-error">{getFieldError(`${base}.quantity`)}</div>
                    ) : null}
                  </td>
                  <td>
                    <input
                      className="dl-input"
                      type="number"
                      step="0.01"
                      min={0}
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(index, 'unitPrice', safeNumericInput(event.target.value) as TItem[keyof TItem])
                      }
                    />
                    {getFieldError?.(`${base}.unitPrice`) ? (
                      <div className="dl-field-error">{getFieldError(`${base}.unitPrice`)}</div>
                    ) : null}
                  </td>
                  <td>
                    <input
                      className="dl-input"
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={item.discountPercent}
                      onChange={(event) =>
                        updateItem(
                          index,
                          'discountPercent',
                          safeNumericInput(event.target.value) as TItem[keyof TItem],
                        )
                      }
                    />
                    {getFieldError?.(`${base}.discountPercent`) ? (
                      <div className="dl-field-error">{getFieldError(`${base}.discountPercent`)}</div>
                    ) : null}
                  </td>
                  <td>
                    <input
                      className="dl-input"
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={item.taxRatePercent}
                      onChange={(event) =>
                        updateItem(
                          index,
                          'taxRatePercent',
                          safeNumericInput(event.target.value) as TItem[keyof TItem],
                        )
                      }
                    />
                    {getFieldError?.(`${base}.taxRatePercent`) ? (
                      <div className="dl-field-error">{getFieldError(`${base}.taxRatePercent`)}</div>
                    ) : null}
                  </td>
                  <td>
                    <strong>{formatCurrency(calculateLineTotalMajor(item))}</strong>
                  </td>
                  <td>
                    <div className="dl-inline-actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() => moveItem(index, -1)}
                        disabled={index === 0}
                        title={index === 0 ? 'Already first line item' : undefined}
                      >
                        Up
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === items.length - 1}
                        title={index === items.length - 1 ? 'Already last line item' : undefined}
                      >
                        Down
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={items.length <= 1}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <Button size="sm" type="button" onClick={addItem}>
          + Add Line Item
        </Button>
      </div>
    </div>
  );
}
