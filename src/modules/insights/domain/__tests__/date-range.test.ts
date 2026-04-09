import { describe, expect, it } from 'vitest';
import { isIsoDateWithinRange, resolveDateRangePreset } from '../date-range';

describe('date range presets', () => {
  it('builds current month range correctly', () => {
    const range = resolveDateRangePreset('current_month', new Date('2026-04-09T10:00:00.000Z'));
    expect(range.from).toBe('2026-04-01');
    expect(range.to).toBe('2026-04-30');
  });

  it('builds previous month range correctly', () => {
    const range = resolveDateRangePreset('previous_month', new Date('2026-04-09T10:00:00.000Z'));
    expect(range.from).toBe('2026-03-01');
    expect(range.to).toBe('2026-03-31');
  });

  it('evaluates date inclusion for open and bounded ranges', () => {
    const bounded = { preset: 'custom' as const, from: '2026-04-01', to: '2026-04-30' };
    expect(isIsoDateWithinRange('2026-04-15', bounded)).toBe(true);
    expect(isIsoDateWithinRange('2026-05-01', bounded)).toBe(false);

    const open = { preset: 'all_time' as const };
    expect(isIsoDateWithinRange('2021-01-01', open)).toBe(true);
  });
});
