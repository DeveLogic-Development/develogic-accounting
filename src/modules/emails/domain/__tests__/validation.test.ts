import { describe, expect, it } from 'vitest';
import { validateComposeDraft, validateTransportPayload } from '../validation';

describe('email validation', () => {
  it('validates compose draft recipient, subject, and body', () => {
    const result = validateComposeDraft({
      document: {
        documentType: 'invoice',
        documentId: 'inv_1',
        documentNumber: 'INV-00048',
        documentStatus: 'draft',
        clientId: 'cl_1',
        clientName: 'Nautilus Labs',
      },
      templateKind: 'invoice_send',
      recipient: {
        to: 'not-an-email',
      },
      subject: '',
      body: '',
    });

    expect(result.isValid).toBe(false);
    expect(result.issues.some((issue) => issue.field === 'recipient.to')).toBe(true);
    expect(result.issues.some((issue) => issue.field === 'subject')).toBe(true);
    expect(result.issues.some((issue) => issue.field === 'body')).toBe(true);
  });

  it('validates server transport payload shape', () => {
    const result = validateTransportPayload({
      document: {
        documentType: 'quote',
        documentId: 'q_1',
        documentNumber: 'QUO-00012',
      },
      recipient: {
        to: 'accounts@nautiluslabs.co.za',
      },
      subject: 'Quote QUO-00012',
      bodyText: 'Please see attached.',
      attachment: {
        fileName: '',
        mimeType: 'application/pdf',
        contentBase64: '',
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.issues.some((issue) => issue.field === 'attachment.fileName')).toBe(true);
    expect(result.issues.some((issue) => issue.field === 'attachment.contentBase64')).toBe(true);
  });
});
