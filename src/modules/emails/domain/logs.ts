import { createId } from '@/modules/accounting/domain/id';
import { createBodySnippet } from './interpolation';
import {
  EmailAttachmentReference,
  EmailComposeDraft,
  EmailLogRecord,
  EmailSendResult,
} from './types';

export function createQueuedEmailLog(draft: EmailComposeDraft, attemptedAt: string): EmailLogRecord {
  return {
    id: createId('email'),
    status: 'queued',
    document: draft.document,
    recipient: draft.recipient,
    subject: draft.subject,
    body: draft.body,
    bodySnippet: createBodySnippet(draft.body),
    templateKind: draft.templateKind,
    attemptedAt,
    resendOfLogId: draft.resendOfLogId,
  };
}

export function markEmailLogSending(log: EmailLogRecord): EmailLogRecord {
  return {
    ...log,
    status: 'sending',
  };
}

export function markEmailLogSent(input: {
  log: EmailLogRecord;
  attachment: EmailAttachmentReference;
  result: EmailSendResult;
}): EmailLogRecord {
  return {
    ...input.log,
    status: 'sent',
    attachment: input.attachment,
    sentAt: input.result.sentAt ?? input.result.attemptedAt,
    provider: input.result.provider,
    providerMessageId: input.result.providerMessageId,
    errorCode: undefined,
    errorMessage: undefined,
  };
}

export function markEmailLogFailed(input: {
  log: EmailLogRecord;
  attachment?: EmailAttachmentReference;
  attemptedAt: string;
  code: string;
  message: string;
}): EmailLogRecord {
  return {
    ...input.log,
    status: 'failed',
    attachment: input.attachment ?? input.log.attachment,
    attemptedAt: input.attemptedAt,
    errorCode: input.code,
    errorMessage: input.message,
  };
}
