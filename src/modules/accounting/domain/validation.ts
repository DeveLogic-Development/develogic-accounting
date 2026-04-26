import {
  InvoiceFormValues,
  InvoicePaymentSubmission,
  InvoicePaymentSubmissionPublicInput,
  InvoicePaymentSubmissionReviewInput,
  PaymentInput,
  QuoteFormValues,
  ValidationIssue,
  ValidationResult,
} from './types';

function makeResult(issues: ValidationIssue[]): ValidationResult {
  return {
    isValid: issues.length === 0,
    issues,
  };
}

function validateSharedLineItems(
  items: Array<{ itemName: string; quantity: number; unitPrice: number; taxRatePercent: number; discountPercent: number }>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (items.length === 0) {
    issues.push({ field: 'items', message: 'At least one line item is required.' });
    return issues;
  }

  items.forEach((item, index) => {
    if (item.itemName.trim().length === 0) {
      issues.push({ field: `items.${index}.itemName`, message: 'Line item name is required.' });
    }

    if (!(item.quantity > 0)) {
      issues.push({ field: `items.${index}.quantity`, message: 'Quantity must be greater than 0.' });
    }

    if (item.unitPrice < 0) {
      issues.push({ field: `items.${index}.unitPrice`, message: 'Unit price must be 0 or greater.' });
    }

    if (item.discountPercent < 0 || item.discountPercent > 100) {
      issues.push({ field: `items.${index}.discountPercent`, message: 'Discount must be between 0 and 100.' });
    }

    if (item.taxRatePercent < 0 || item.taxRatePercent > 100) {
      issues.push({ field: `items.${index}.taxRatePercent`, message: 'Tax rate must be between 0 and 100.' });
    }
  });

  return issues;
}

export function validateQuoteForm(values: QuoteFormValues): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (values.quoteNumber && !/^[A-Za-z0-9\-_\/]+$/.test(values.quoteNumber.trim())) {
    issues.push({ field: 'quoteNumber', message: 'Quote number contains invalid characters.' });
  }

  if (values.clientId.trim().length === 0) {
    issues.push({ field: 'clientId', message: 'Client is required.' });
  }

  if (!values.issueDate) {
    issues.push({ field: 'issueDate', message: 'Issue date is required.' });
  }

  if (!values.expiryDate) {
    issues.push({ field: 'expiryDate', message: 'Expiry date is required.' });
  }

  if (!values.templateId || !values.templateVersionId) {
    issues.push({ field: 'templateVersionId', message: 'A template must be selected.' });
  }

  if (values.issueDate && values.expiryDate) {
    const issue = new Date(values.issueDate);
    const expiry = new Date(values.expiryDate);
    if (issue > expiry) {
      issues.push({ field: 'expiryDate', message: 'Expiry date cannot be before issue date.' });
    }
  }

  if (values.documentDiscountPercent < 0 || values.documentDiscountPercent > 100) {
    issues.push({
      field: 'documentDiscountPercent',
      message: 'Document discount must be between 0 and 100.',
    });
  }

  if (typeof values.adjustment === 'number' && !Number.isFinite(values.adjustment)) {
    issues.push({
      field: 'adjustment',
      message: 'Adjustment must be a valid number.',
    });
  }

  if (
    values.recipientEmails &&
    values.recipientEmails.some((email) => email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
  ) {
    issues.push({
      field: 'recipientEmails',
      message: 'Recipient email list contains one or more invalid addresses.',
    });
  }

  issues.push(...validateSharedLineItems(values.items));

  return makeResult(issues);
}

export function validateInvoiceForm(values: InvoiceFormValues): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (values.invoiceNumber && !/^[A-Za-z0-9\-_\/]+$/.test(values.invoiceNumber.trim())) {
    issues.push({ field: 'invoiceNumber', message: 'Invoice number contains invalid characters.' });
  }

  if (values.clientId.trim().length === 0) {
    issues.push({ field: 'clientId', message: 'Client is required.' });
  }

  if (!values.accountsReceivableAccountId || values.accountsReceivableAccountId.trim().length === 0) {
    issues.push({ field: 'accountsReceivableAccountId', message: 'Accounts receivable account is required.' });
  }

  if (!values.terms.trim()) {
    issues.push({ field: 'terms', message: 'Invoice terms are required.' });
  }

  if (!values.issueDate) {
    issues.push({ field: 'issueDate', message: 'Issue date is required.' });
  }

  if (!values.dueDate) {
    issues.push({ field: 'dueDate', message: 'Due date is required.' });
  }

  if (!values.templateId || !values.templateVersionId) {
    issues.push({ field: 'templateVersionId', message: 'A template must be selected.' });
  }

  if (values.issueDate && values.dueDate) {
    const issue = new Date(values.issueDate);
    const due = new Date(values.dueDate);
    if (issue > due) {
      issues.push({ field: 'dueDate', message: 'Due date cannot be before issue date.' });
    }
  }

  if (values.documentDiscountPercent < 0 || values.documentDiscountPercent > 100) {
    issues.push({
      field: 'documentDiscountPercent',
      message: 'Document discount must be between 0 and 100.',
    });
  }

  if (typeof values.adjustment === 'number' && !Number.isFinite(values.adjustment)) {
    issues.push({
      field: 'adjustment',
      message: 'Adjustment must be a valid number.',
    });
  }

  if (
    values.recipientEmails &&
    values.recipientEmails.some((email) => email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
  ) {
    issues.push({
      field: 'recipientEmails',
      message: 'Recipient email list contains one or more invalid addresses.',
    });
  }

  issues.push(...validateSharedLineItems(values.items));

  return makeResult(issues);
}

export function validatePaymentInput(input: PaymentInput, outstandingAmount: number): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!(input.amount > 0)) {
    issues.push({ field: 'amount', message: 'Payment amount must be greater than 0.' });
  }

  if (input.amount > outstandingAmount) {
    issues.push({ field: 'amount', message: 'Payment cannot exceed outstanding amount.' });
  }

  if (!input.paymentDate) {
    issues.push({ field: 'paymentDate', message: 'Payment date is required.' });
  }

  return makeResult(issues);
}

export function validateInvoicePaymentSubmissionPublicInput(
  input: InvoicePaymentSubmissionPublicInput,
  options?: {
    maxFileSizeBytes?: number;
    allowedMimeTypes?: string[];
  },
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const allowedMimeTypes = new Set(
    (options?.allowedMimeTypes ?? ['application/pdf', 'image/jpeg', 'image/png']).map((entry) =>
      entry.trim().toLowerCase(),
    ),
  );
  const maxFileSizeBytes = options?.maxFileSizeBytes ?? 10 * 1024 * 1024;

  if (!input.publicToken.trim()) {
    issues.push({ field: 'publicToken', message: 'Invoice payment submission token is required.' });
  }

  if (!(input.submittedAmount > 0)) {
    issues.push({ field: 'submittedAmount', message: 'Submitted payment amount must be greater than 0.' });
  }

  if (!input.submittedPaymentDate) {
    issues.push({ field: 'submittedPaymentDate', message: 'Payment date is required.' });
  }

  if (!input.proofFile.fileName.trim()) {
    issues.push({ field: 'proofFile.fileName', message: 'Proof of payment file name is required.' });
  }

  if (!(input.proofFile.sizeBytes > 0)) {
    issues.push({ field: 'proofFile.sizeBytes', message: 'Proof of payment file size must be greater than 0.' });
  } else if (input.proofFile.sizeBytes > maxFileSizeBytes) {
    issues.push({
      field: 'proofFile.sizeBytes',
      message: `Proof of payment file exceeds the maximum size (${Math.round(maxFileSizeBytes / 1024 / 1024)} MB).`,
    });
  }

  const normalizedMimeType = input.proofFile.mimeType.trim().toLowerCase();
  if (!normalizedMimeType) {
    issues.push({ field: 'proofFile.mimeType', message: 'Proof of payment file type is required.' });
  } else if (!allowedMimeTypes.has(normalizedMimeType)) {
    issues.push({ field: 'proofFile.mimeType', message: 'Unsupported proof of payment file type.' });
  }

  if (
    input.payerEmail &&
    input.payerEmail.trim().length > 0 &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.payerEmail.trim())
  ) {
    issues.push({ field: 'payerEmail', message: 'Payer email must be valid.' });
  }

  return makeResult(issues);
}

export function validateInvoicePaymentSubmissionReviewInput(
  submission: InvoicePaymentSubmission,
  input: InvoicePaymentSubmissionReviewInput,
  outstandingAmount: number,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (submission.status === 'approved') {
    issues.push({ field: 'status', message: 'Approved submissions cannot be reviewed again.' });
  }

  if (input.status === 'approved') {
    const approvedAmount = input.approvedAmount ?? submission.submittedAmountMinor / 100;
    if (!(approvedAmount > 0)) {
      issues.push({ field: 'approvedAmount', message: 'Approved amount must be greater than 0.' });
    }
    if (approvedAmount > outstandingAmount) {
      issues.push({ field: 'approvedAmount', message: 'Approved amount cannot exceed outstanding balance.' });
    }
    if (input.approvedPaymentDate && Number.isNaN(new Date(input.approvedPaymentDate).getTime())) {
      issues.push({ field: 'approvedPaymentDate', message: 'Approved payment date is invalid.' });
    }
  }

  if (input.status === 'rejected' && !input.reviewNotes?.trim()) {
    issues.push({ field: 'reviewNotes', message: 'Review notes are required when rejecting a submission.' });
  }

  return makeResult(issues);
}
