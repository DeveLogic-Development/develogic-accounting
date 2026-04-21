export function formatCurrency(value: number, currency = 'ZAR'): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatMinorCurrency(valueMinor: number, currency = 'ZAR'): string {
  return formatCurrency(valueMinor / 100, currency);
}

export function formatDate(date: string | Date | null | undefined, fallback = '—'): string {
  if (!date) return fallback;
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const now = Date.now();
  const parsed = date instanceof Date ? date : new Date(date);
  const then = parsed.getTime();
  if (Number.isNaN(then)) return '—';
  const diffMs = now - then;
  const dayMs = 24 * 60 * 60 * 1000;

  if (diffMs < dayMs) return 'Today';
  if (diffMs < 2 * dayMs) return 'Yesterday';

  const days = Math.floor(diffMs / dayMs);
  return `${days} days ago`;
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;

  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}
