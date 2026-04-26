function normalizeDecimalText(value: string): string {
  const normalized = String(value ?? '').replace(/,/g, '.');
  const cleaned = normalized.replace(/[^0-9.]/g, '');
  return cleaned.replace(/(\..*)\./g, '$1');
}

export function sanitizeDecimalTextInput(value: string): string {
  return normalizeDecimalText(value);
}

export function sanitizeIntegerTextInput(value: string): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function toSanitizedDecimalNumber(value: string, fallback = 0): number {
  const sanitized = normalizeDecimalText(value);
  if (sanitized === '' || sanitized === '.') return fallback;
  const numeric = Number(sanitized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function toSanitizedIntegerNumber(value: string, fallback = 0): number {
  const sanitized = sanitizeIntegerTextInput(value);
  if (!sanitized) return fallback;
  const numeric = Number.parseInt(sanitized, 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}
