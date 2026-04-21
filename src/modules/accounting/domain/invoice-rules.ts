import { addDaysIsoDate } from './date';
import { InvoiceStatus, TransitionResult } from './types';

export type InvoiceTermsCode =
  | 'due_on_receipt'
  | 'net_7'
  | 'net_14'
  | 'net_30'
  | 'net_45'
  | 'net_60'
  | 'custom';

const TERMS_DAYS: Record<Exclude<InvoiceTermsCode, 'custom'>, number> = {
  due_on_receipt: 0,
  net_7: 7,
  net_14: 14,
  net_30: 30,
  net_45: 45,
  net_60: 60,
};

const INVOICE_MANUAL_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['approved', 'sent', 'void'],
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

export function deriveDueDateForTerms(
  issueDate: string,
  termsCode: InvoiceTermsCode,
  currentDueDate?: string,
): string {
  if (!issueDate) return currentDueDate ?? '';
  if (termsCode === 'custom') return currentDueDate ?? issueDate;
  return addDaysIsoDate(issueDate, TERMS_DAYS[termsCode]);
}

export function getInvoiceTermsLabel(termsCode: InvoiceTermsCode): string {
  if (termsCode === 'due_on_receipt') return 'Due on Receipt';
  if (termsCode === 'net_7') return 'Net 7';
  if (termsCode === 'net_14') return 'Net 14';
  if (termsCode === 'net_30') return 'Net 30';
  if (termsCode === 'net_45') return 'Net 45';
  if (termsCode === 'net_60') return 'Net 60';
  return 'Custom';
}

export function canMakeInvoiceRecurring(status: InvoiceStatus): TransitionResult {
  if (status === 'void') {
    return { allowed: false, reason: 'Voided invoices cannot be converted to recurring profiles.' };
  }
  return { allowed: true };
}

export function canCreateCreditNote(status: InvoiceStatus): TransitionResult {
  if (status === 'draft') {
    return { allowed: false, reason: 'Draft invoices cannot be credited.' };
  }
  if (status === 'void') {
    return { allowed: false, reason: 'Voided invoices cannot be credited.' };
  }
  return { allowed: true };
}

export interface InvoiceActionAvailability {
  canEdit: TransitionResult;
  canSend: TransitionResult;
  canMarkSent: TransitionResult;
  canRecordPayment: TransitionResult;
  canMakeRecurring: TransitionResult;
  canCreateCreditNote: TransitionResult;
  canVoid: TransitionResult;
  canDelete: TransitionResult;
}

export function getInvoiceActionAvailability(status: InvoiceStatus, outstandingMinor: number): InvoiceActionAvailability {
  const canSend: TransitionResult =
    status === 'draft' || status === 'approved'
      ? { allowed: true }
      : { allowed: false, reason: 'Only draft/open invoices can be sent.' };

  const canMarkSent: TransitionResult =
    status === 'draft' || status === 'approved'
      ? { allowed: true }
      : { allowed: false, reason: 'Only draft/open invoices can be marked as sent.' };

  const canVoid: TransitionResult =
    status === 'void' || status === 'paid'
      ? { allowed: false, reason: status === 'void' ? 'Invoice is already void.' : 'Paid invoices cannot be voided.' }
      : { allowed: true };

  const canDelete: TransitionResult =
    status === 'draft' && outstandingMinor <= 0
      ? { allowed: true }
      : { allowed: false, reason: 'Only draft invoices without payments can be deleted.' };

  return {
    canEdit: canEditInvoice(status),
    canSend,
    canMarkSent,
    canRecordPayment: canRecordPayment(status),
    canMakeRecurring: canMakeInvoiceRecurring(status),
    canCreateCreditNote: canCreateCreditNote(status),
    canVoid,
    canDelete,
  };
}
