import { DateRange, DateRangePreset } from './types';

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, date.getDate());
}

export function resolveDateRangePreset(preset: DateRangePreset, now = new Date()): DateRange {
  if (preset === 'all_time') {
    return { preset };
  }

  if (preset === 'last_30_days') {
    const to = toIsoDate(now);
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 29);
    return {
      preset,
      from: toIsoDate(fromDate),
      to,
    };
  }

  if (preset === 'previous_month') {
    const reference = shiftMonth(now, -1);
    return {
      preset,
      from: toIsoDate(startOfMonth(reference)),
      to: toIsoDate(endOfMonth(reference)),
    };
  }

  return {
    preset: 'current_month',
    from: toIsoDate(startOfMonth(now)),
    to: toIsoDate(endOfMonth(now)),
  };
}

export function isIsoDateWithinRange(dateValue: string, range: DateRange): boolean {
  if (!dateValue) return false;
  const date = dateValue.slice(0, 10);
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

export function labelForPreset(preset: DateRangePreset): string {
  switch (preset) {
    case 'current_month':
      return 'Current Month';
    case 'previous_month':
      return 'Previous Month';
    case 'last_30_days':
      return 'Last 30 Days';
    case 'custom':
      return 'Custom';
    default:
      return 'All Time';
  }
}
