import { describe, expect, it } from 'vitest';
import { addRecurringIntervalIsoDate } from '../date';

describe('addRecurringIntervalIsoDate', () => {
  it('increments weekly cadence', () => {
    expect(addRecurringIntervalIsoDate('2026-04-22', 'weekly', 1)).toBe('2026-04-29');
    expect(addRecurringIntervalIsoDate('2026-04-22', 'weekly', 2)).toBe('2026-05-06');
  });

  it('increments monthly and quarterly cadence', () => {
    expect(addRecurringIntervalIsoDate('2026-04-22', 'monthly', 1)).toBe('2026-05-22');
    expect(addRecurringIntervalIsoDate('2026-04-22', 'quarterly', 1)).toBe('2026-07-22');
  });

  it('increments yearly cadence', () => {
    expect(addRecurringIntervalIsoDate('2026-04-22', 'yearly', 1)).toBe('2027-04-22');
  });
});
