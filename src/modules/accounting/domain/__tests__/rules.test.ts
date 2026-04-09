import { describe, expect, it } from 'vitest';
import { canConvertQuote, canEditQuote, canTransitionQuote } from '../quote-rules';
import { canRecordPayment, canTransitionInvoice } from '../invoice-rules';

describe('quote rules', () => {
  it('allows only valid quote transitions', () => {
    expect(canTransitionQuote('draft', 'sent').allowed).toBe(true);
    expect(canTransitionQuote('draft', 'accepted').allowed).toBe(false);
    expect(canTransitionQuote('accepted', 'rejected').allowed).toBe(false);
  });

  it('enforces quote edit and conversion guards', () => {
    expect(canEditQuote('draft').allowed).toBe(true);
    expect(canEditQuote('sent').allowed).toBe(false);
    expect(canConvertQuote('accepted').allowed).toBe(true);
    expect(canConvertQuote('expired').allowed).toBe(false);
  });
});

describe('invoice rules', () => {
  it('enforces invoice transition guards', () => {
    expect(canTransitionInvoice('draft', 'approved').allowed).toBe(true);
    expect(canTransitionInvoice('draft', 'sent').allowed).toBe(false);
    expect(canTransitionInvoice('paid', 'void').allowed).toBe(false);
  });

  it('prevents invalid payment states', () => {
    expect(canRecordPayment('void').allowed).toBe(false);
    expect(canRecordPayment('draft').allowed).toBe(false);
    expect(canRecordPayment('sent').allowed).toBe(true);
  });
});
