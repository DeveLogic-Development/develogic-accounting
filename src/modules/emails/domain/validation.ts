import { EmailComposeDraft, EmailTransportPayload, EmailValidationIssue, EmailValidationResult } from './types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmailAddress(value: string, field: string, issues: EmailValidationIssue[]) {
  if (!value.trim()) {
    issues.push({ field, message: `${field} is required.` });
    return;
  }

  if (!EMAIL_PATTERN.test(value.trim())) {
    issues.push({ field, message: `${field} is not a valid email address.` });
  }
}

export function validateComposeDraft(draft: EmailComposeDraft): EmailValidationResult {
  const issues: EmailValidationIssue[] = [];

  validateEmailAddress(draft.recipient.to, 'recipient.to', issues);

  if (draft.recipient.cc?.trim()) {
    validateEmailAddress(draft.recipient.cc, 'recipient.cc', issues);
  }

  if (!draft.subject.trim()) {
    issues.push({ field: 'subject', message: 'Subject is required.' });
  }

  if (!draft.body.trim()) {
    issues.push({ field: 'body', message: 'Body is required.' });
  }

  if (!draft.document.documentId.trim() || !draft.document.documentNumber.trim()) {
    issues.push({ field: 'document', message: 'Document reference is incomplete.' });
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function validateTransportPayload(payload: EmailTransportPayload): EmailValidationResult {
  const issues: EmailValidationIssue[] = [];

  validateEmailAddress(payload.recipient.to, 'recipient.to', issues);
  if (payload.recipient.cc?.trim()) {
    validateEmailAddress(payload.recipient.cc, 'recipient.cc', issues);
  }

  if (!payload.subject.trim()) {
    issues.push({ field: 'subject', message: 'Subject is required.' });
  }

  if (!payload.bodyText.trim()) {
    issues.push({ field: 'bodyText', message: 'Message body is required.' });
  }

  if (!payload.attachment.fileName.trim()) {
    issues.push({ field: 'attachment.fileName', message: 'Attachment file name is required.' });
  }

  if (!payload.attachment.contentBase64.trim()) {
    issues.push({ field: 'attachment.contentBase64', message: 'Attachment content is required.' });
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function summarizeEmailValidationIssues(issues: EmailValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(' ');
}
