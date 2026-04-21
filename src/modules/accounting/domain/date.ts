import type { RecurringInvoiceFrequency } from './types';

export function todayIsoDate(): string {
  const now = new Date();
  const localIsoSafe = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localIsoSafe.toISOString().slice(0, 10);
}

export function addDaysIsoDate(startIsoDate: string, days: number): string {
  const date = new Date(startIsoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addRecurringIntervalIsoDate(
  startIsoDate: string,
  frequency: RecurringInvoiceFrequency,
  interval: number,
): string {
  const [yearText, monthText, dayText] = startIsoDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const safeInterval = Number.isFinite(interval) && interval > 0 ? Math.floor(interval) : 1;
  if (!year || !month || !day) return startIsoDate;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (frequency === 'weekly') {
    date.setUTCDate(date.getUTCDate() + safeInterval * 7);
  } else if (frequency === 'monthly') {
    date.setUTCMonth(date.getUTCMonth() + safeInterval);
  } else if (frequency === 'quarterly') {
    date.setUTCMonth(date.getUTCMonth() + safeInterval * 3);
  } else {
    date.setUTCFullYear(date.getUTCFullYear() + safeInterval);
  }
  return date.toISOString().slice(0, 10);
}
