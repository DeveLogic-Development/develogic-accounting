import {
  InvoiceFormValues,
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
