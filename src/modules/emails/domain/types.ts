export type EmailDocumentType = 'quote' | 'invoice';
export type EmailTemplateKind = 'quote_send' | 'invoice_send';
export type EmailLogStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface EmailRecipient {
  to: string;
  cc?: string;
}

export interface EmailDocumentReference {
  documentType: EmailDocumentType;
  documentId: string;
  documentNumber: string;
  documentStatus: string;
  clientId: string;
  clientName: string;
}

export interface EmailAttachmentReference {
  pdfArchiveRecordId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  checksum: string;
  sizeBytes: number;
  revision: number;
  immutable: boolean;
  templateId?: string;
  templateVersionId?: string;
  templateName?: string;
  templateVersionNumber?: number;
}

export interface EmailComposeDraft {
  document: EmailDocumentReference;
  templateKind: EmailTemplateKind;
  recipient: EmailRecipient;
  subject: string;
  body: string;
  attachmentRecordId?: string;
  resendOfLogId?: string;
}

export interface EmailFailureReason {
  code: string;
  message: string;
}

export interface EmailSendRequest {
  document: EmailDocumentReference;
  recipient: EmailRecipient;
  subject: string;
  body: string;
  attachmentRecordId?: string;
  templateKind: EmailTemplateKind;
  resendOfLogId?: string;
}

export interface EmailTransportAttachment {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

export interface EmailTransportPayload {
  document: {
    documentType: EmailDocumentType;
    documentId: string;
    documentNumber: string;
  };
  recipient: EmailRecipient;
  subject: string;
  bodyText: string;
  attachment: EmailTransportAttachment;
}

export interface EmailSendResult {
  ok: boolean;
  attemptedAt: string;
  sentAt?: string;
  provider?: string;
  providerMessageId?: string;
  error?: EmailFailureReason;
}

export interface EmailCapability {
  canSend: boolean;
  mode: 'smtp' | 'mock' | 'disabled' | 'unknown';
  reason?: string;
  maxAttachmentBytes?: number;
  checkedAt?: string;
  source: 'server' | 'fallback';
}

export interface EmailLogRecord {
  id: string;
  status: EmailLogStatus;
  document: EmailDocumentReference;
  recipient: EmailRecipient;
  subject: string;
  body: string;
  bodySnippet: string;
  attachment?: EmailAttachmentReference;
  templateKind: EmailTemplateKind;
  attemptedAt: string;
  sentAt?: string;
  provider?: string;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  resendOfLogId?: string;
}

export interface EmailLogListRow {
  id: string;
  status: EmailLogStatus;
  documentType: EmailDocumentType;
  documentId: string;
  documentNumber: string;
  recipientEmail: string;
  subject: string;
  bodySnippet: string;
  attemptedAt: string;
  sentAt?: string;
  hasAttachment: boolean;
  attachmentFileName?: string;
  resendOfLogId?: string;
  errorMessage?: string;
}

export interface EmailTemplatePayload {
  businessName: string;
  clientName: string;
  documentNumber: string;
  issueDate: string;
  dueDate?: string;
  expiryDate?: string;
  totalFormatted: string;
}

export interface EmailTemplateDefinition {
  kind: EmailTemplateKind;
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface EmailValidationIssue {
  field: string;
  message: string;
}

export interface EmailValidationResult {
  isValid: boolean;
  issues: EmailValidationIssue[];
}

export interface EmailsState {
  logs: EmailLogRecord[];
}
