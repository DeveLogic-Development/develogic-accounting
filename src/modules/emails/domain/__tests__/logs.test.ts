import { describe, expect, it } from 'vitest';
import {
  createQueuedEmailLog,
  markEmailLogFailed,
  markEmailLogSending,
  markEmailLogSent,
} from '../logs';
import { EmailComposeDraft } from '../types';

const draft: EmailComposeDraft = {
  document: {
    documentType: 'quote',
    documentId: 'q_1',
    documentNumber: 'QUO-00012',
    documentStatus: 'draft',
    clientId: 'cl_1',
    clientName: 'Nautilus Labs',
  },
  templateKind: 'quote_send',
  recipient: {
    to: 'accounts@nautiluslabs.co.za',
  },
  subject: 'Quote QUO-00012',
  body: 'Hello, see attached quote.',
};

describe('email log lifecycle', () => {
  it('creates queued logs with body snippets', () => {
    const log = createQueuedEmailLog(draft, '2026-04-09T12:00:00.000Z');
    expect(log.status).toBe('queued');
    expect(log.bodySnippet.length).toBeGreaterThan(0);
  });

  it('marks log sent with provider metadata and attachment', () => {
    const queued = createQueuedEmailLog(draft, '2026-04-09T12:00:00.000Z');
    const sending = markEmailLogSending(queued);
    const sent = markEmailLogSent({
      log: sending,
      attachment: {
        pdfArchiveRecordId: 'pdf_1',
        fileName: 'quote-quo-00012-v1.pdf',
        mimeType: 'application/pdf',
        storageKey: 'pdf/quote/q_1/quote-quo-00012-v1.pdf',
        checksum: 'deadbeef',
        sizeBytes: 1024,
        revision: 1,
        immutable: true,
      },
      result: {
        ok: true,
        attemptedAt: '2026-04-09T12:00:00.000Z',
        sentAt: '2026-04-09T12:00:03.000Z',
        provider: 'nodemailer',
        providerMessageId: 'msg_1',
      },
    });

    expect(sent.status).toBe('sent');
    expect(sent.providerMessageId).toBe('msg_1');
    expect(sent.attachment?.pdfArchiveRecordId).toBe('pdf_1');
  });

  it('marks log failed with a structured reason', () => {
    const queued = createQueuedEmailLog(draft, '2026-04-09T12:00:00.000Z');
    const failed = markEmailLogFailed({
      log: queued,
      attemptedAt: '2026-04-09T12:00:05.000Z',
      code: 'SMTP_SEND_FAILED',
      message: 'Connection timeout',
    });

    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('SMTP_SEND_FAILED');
    expect(failed.errorMessage).toContain('timeout');
  });
});
