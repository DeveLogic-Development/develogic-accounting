import { InvoiceStatus, TransitionResult } from './types';

const INVOICE_MANUAL_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['approved', 'void'],
  approved: ['sent', 'void'],
  sent: ['void'],
  partially_paid: ['void'],
  paid: [],
  overdue: ['void'],
  void: [],
};

export function getAllowedInvoiceManualTransitions(status: InvoiceStatus): InvoiceStatus[] {
  return INVOICE_MANUAL_TRANSITIONS[status];
}

export function canTransitionInvoice(current: InvoiceStatus, target: InvoiceStatus): TransitionResult {
  if (current === target) return { allowed: true };

  const allowedTargets = INVOICE_MANUAL_TRANSITIONS[current] || [];
  if (allowedTargets.includes(target)) return { allowed: true };

  return {
    allowed: false,
    reason: `Invalid invoice transition: ${current} -> ${target}`,
  };
}

export function canEditInvoice(status: InvoiceStatus): TransitionResult {
  if (status === 'draft') return { allowed: true };

  return {
    allowed: false,
    reason: 'Only draft invoices can be edited in this phase.',
  };
}

export function canRecordPayment(status: InvoiceStatus): TransitionResult {
  if (status === 'void') {
    return { allowed: false, reason: 'Cannot record payment on a void invoice.' };
  }

  if (status === 'draft') {
    return { allowed: false, reason: 'Draft invoices must be approved/sent before payment.' };
  }

  if (status === 'paid') {
    return { allowed: false, reason: 'Invoice is already fully paid.' };
  }

  return { allowed: true };
}
