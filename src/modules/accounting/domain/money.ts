export const MONEY_SCALE = 100;
const QTY_SCALE = 1000;

export function toMinor(amountMajor: number): number {
  if (!Number.isFinite(amountMajor)) return 0;
  return Math.round(amountMajor * MONEY_SCALE);
}

export function fromMinor(amountMinor: number): number {
  return amountMinor / MONEY_SCALE;
}

export function multiplyQuantityByUnitPriceMinor(quantity: number, unitPriceMinor: number): number {
  const quantityScaled = Math.round(quantity * QTY_SCALE);
  return Math.round((quantityScaled * unitPriceMinor) / QTY_SCALE);
}

export function percentageOfMinor(amountMinor: number, percent: number): number {
  return Math.round((amountMinor * percent) / 100);
}

export function clampMinor(valueMinor: number, minMinor = 0): number {
  if (valueMinor < minMinor) return minMinor;
  return valueMinor;
}
