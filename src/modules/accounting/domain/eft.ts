import { deriveInvoicePaymentSummary } from './calculations';
import {
  AccountingState,
  Invoice,
  InvoicePaymentSubmission,
  InvoicePaymentSubmissionState,
  InvoicePaymentSubmissionStatus,
} from './types';
import { BusinessSettings, defaultBusinessSettings } from '@/modules/settings/domain/business-settings';

const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function createInvoicePublicPaymentToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join('');
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function buildInvoicePaymentReference(input: {
  invoiceNumber: string;
  clientName?: string;
  instructionTemplate?: string;
}): string {
  const template = (input.instructionTemplate ?? defaultBusinessSettings.eftReferenceInstruction).trim();
  if (!template) return input.invoiceNumber;

  return template
    .replace(/\{\{\s*invoice_number\s*\}\}/gi, input.invoiceNumber)
    .replace(/\{\{\s*client_name\s*\}\}/gi, input.clientName ?? '')
    .trim();
}

export function buildInvoicePaymentSubmissionUrl(baseUrl: string | undefined, publicToken: string | undefined): string {
  if (!baseUrl || !publicToken) return '';
  return `${baseUrl.replace(/\/+$/, '')}/pay/invoice/${publicToken}`;
}

export function buildEftInstructionLines(input: {
  invoiceNumber: string;
  clientName?: string;
  settings?: Pick<
    BusinessSettings,
    | 'eftBankName'
    | 'eftAccountHolder'
    | 'eftAccountNumber'
    | 'eftBranchCode'
    | 'eftAccountType'
    | 'eftSwiftBic'
    | 'eftReferenceInstruction'
    | 'eftInstructionNotes'
  >;
}): string[] {
  const settings = {
    eftBankName: input.settings?.eftBankName ?? defaultBusinessSettings.eftBankName,
    eftAccountHolder: input.settings?.eftAccountHolder ?? defaultBusinessSettings.eftAccountHolder,
    eftAccountNumber: input.settings?.eftAccountNumber ?? defaultBusinessSettings.eftAccountNumber,
    eftBranchCode: input.settings?.eftBranchCode ?? defaultBusinessSettings.eftBranchCode,
    eftAccountType: input.settings?.eftAccountType ?? defaultBusinessSettings.eftAccountType,
    eftSwiftBic: input.settings?.eftSwiftBic ?? defaultBusinessSettings.eftSwiftBic,
    eftReferenceInstruction:
      input.settings?.eftReferenceInstruction ?? defaultBusinessSettings.eftReferenceInstruction,
    eftInstructionNotes: input.settings?.eftInstructionNotes ?? defaultBusinessSettings.eftInstructionNotes,
  };
  const paymentReference = buildInvoicePaymentReference({
    invoiceNumber: input.invoiceNumber,
    clientName: input.clientName,
    instructionTemplate: settings.eftReferenceInstruction,
  });

  const lines = [
    `Bank: ${settings.eftBankName}`,
    `Account Holder: ${settings.eftAccountHolder}`,
    `Account Number: ${settings.eftAccountNumber}`,
    `Branch Code: ${settings.eftBranchCode}`,
    `Account Type: ${settings.eftAccountType}`,
    settings.eftSwiftBic ? `SWIFT/BIC: ${settings.eftSwiftBic}` : '',
    `Payment Reference: ${paymentReference}`,
    settings.eftInstructionNotes,
  ];

  return lines.map((line) => line.trim()).filter(Boolean);
}

export function selectInvoicePaymentSubmissions(
  state: AccountingState,
  invoiceId: string,
): InvoicePaymentSubmission[] {
  return state.paymentSubmissions
    .filter((entry) => entry.invoiceId === invoiceId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function deriveInvoicePaymentSubmissionState(
  submissions: InvoicePaymentSubmission[],
): InvoicePaymentSubmissionState {
  if (submissions.length === 0) return 'none';
  const latest = submissions
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return 'none';
  if (latest.status === 'submitted') return 'submitted';
  if (latest.status === 'under_review') return 'under_review';
  if (latest.status === 'rejected') return 'rejected';
  if (latest.status === 'approved') return 'approved';
  return 'none';
}

export function isInvoiceEligibleForProofSubmission(input: {
  invoice: Invoice;
  state: AccountingState;
  nowIso?: string;
  settings: Pick<BusinessSettings, 'eftEnabled' | 'eftPublicSubmissionEnabled'>;
}): { allowed: boolean; reason?: string } {
  if (!input.settings.eftEnabled) {
    return { allowed: false, reason: 'EFT payments are currently disabled.' };
  }
  if (!input.settings.eftPublicSubmissionEnabled) {
    return { allowed: false, reason: 'Public proof submissions are currently disabled.' };
  }

  if (input.invoice.status === 'paid') {
    return { allowed: false, reason: 'This invoice is already fully paid.' };
  }
  if (input.invoice.status === 'void') {
    return { allowed: false, reason: 'Voided invoices cannot accept proof submissions.' };
  }
  if (input.invoice.status === 'draft') {
    return { allowed: false, reason: 'Draft invoices cannot accept proof submissions yet.' };
  }

  const summary = deriveInvoicePaymentSummary(input.invoice, input.state.payments, input.nowIso);
  if (summary.derivedStatus === 'paid') {
    return { allowed: false, reason: 'This invoice is already fully paid.' };
  }
  if (summary.derivedStatus === 'void') {
    return { allowed: false, reason: 'Voided invoices cannot accept proof submissions.' };
  }
  if (summary.derivedStatus === 'draft') {
    return { allowed: false, reason: 'Draft invoices cannot accept proof submissions yet.' };
  }

  return { allowed: true };
}

export function canTransitionSubmission(
  current: InvoicePaymentSubmissionStatus,
  target: InvoicePaymentSubmissionStatus,
): { allowed: boolean; reason?: string } {
  if (current === target) return { allowed: true };
  if (current === 'approved') {
    return { allowed: false, reason: 'Approved submissions cannot be changed.' };
  }
  if (current === 'cancelled') {
    return { allowed: false, reason: 'Cancelled submissions cannot be changed.' };
  }
  if (current === 'rejected' && target === 'under_review') {
    return { allowed: false, reason: 'Rejected submissions should be resubmitted as a new proof.' };
  }
  return { allowed: true };
}
