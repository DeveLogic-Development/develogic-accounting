import { describe, expect, it } from 'vitest';
import { canConvertQuote, canEditQuote, canTransitionQuote } from '../quote-rules';
import { canRecordPayment, canTransitionInvoice, deriveDueDateForTerms, getInvoiceActionAvailability } from '../invoice-rules';

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
    expect(canTransitionInvoice('draft', 'sent').allowed).toBe(true);
    expect(canTransitionInvoice('paid', 'void').allowed).toBe(false);
  });

  it('prevents invalid payment states', () => {
    expect(canRecordPayment('void').allowed).toBe(false);
    expect(canRecordPayment('draft').allowed).toBe(false);
    expect(canRecordPayment('sent').allowed).toBe(true);
  });

  it('derives due dates from terms', () => {
    expect(deriveDueDateForTerms('2026-04-21', 'due_on_receipt')).toBe('2026-04-21');
    expect(deriveDueDateForTerms('2026-04-21', 'net_30')).toBe('2026-05-21');
    expect(deriveDueDateForTerms('2026-04-21', 'custom', '2026-04-30')).toBe('2026-04-30');
  });

  it('computes invoice action availability for draft and paid states', () => {
    const draftActions = getInvoiceActionAvailability('draft', 5000);
    expect(draftActions.canEdit.allowed).toBe(true);
    expect(draftActions.canSend.allowed).toBe(true);
    expect(draftActions.canRecordPayment.allowed).toBe(false);

    const paidActions = getInvoiceActionAvailability('paid', 0);
    expect(paidActions.canSend.allowed).toBe(false);
    expect(paidActions.canRecordPayment.allowed).toBe(false);
    expect(paidActions.canDelete.allowed).toBe(false);
  });
});
