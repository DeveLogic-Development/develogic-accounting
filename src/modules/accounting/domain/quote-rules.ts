import { QuoteStatus, TransitionResult } from './types';

const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent', 'expired'],
  sent: ['viewed', 'accepted', 'rejected', 'expired'],
  viewed: ['accepted', 'rejected', 'expired'],
  accepted: ['converted'],
  rejected: [],
  expired: [],
  converted: [],
};

export function getAllowedQuoteTransitions(status: QuoteStatus): QuoteStatus[] {
  return QUOTE_TRANSITIONS[status];
}

export function canTransitionQuote(current: QuoteStatus, target: QuoteStatus): TransitionResult {
  if (current === target) {
    return { allowed: true };
  }

  const allowedTargets = QUOTE_TRANSITIONS[current] || [];
  if (allowedTargets.includes(target)) return { allowed: true };

  return {
    allowed: false,
    reason: `Invalid quote status transition: ${current} -> ${target}`,
  };
}

export function canEditQuote(status: QuoteStatus): TransitionResult {
  if (status === 'draft') return { allowed: true };

  return {
    allowed: false,
    reason: 'Only draft quotes can be edited in this phase.',
  };
}

export function canConvertQuote(status: QuoteStatus): TransitionResult {
  if (status === 'accepted') return { allowed: true };

  return {
    allowed: false,
    reason: 'Only accepted quotes can be converted to invoices.',
  };
}
