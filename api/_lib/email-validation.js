const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/=\s]+$/;
const DOCUMENT_TYPE_SET = new Set(['quote', 'invoice']);

function sanitizeText(value, maxLength) {
  const normalized = String(value || '').replace(/\u0000/g, '').trim();
  return normalized.slice(0, maxLength);
}

function sanitizeFilename(value) {
  const cleaned = String(value || '')
    .replace(/[\\/]/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.slice(0, 180);
}

function estimateBase64SizeBytes(base64) {
  const cleaned = base64.replace(/\s+/g, '');
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  return Math.floor((cleaned.length * 3) / 4) - padding;
}

function isEmail(value) {
  return EMAIL_PATTERN.test(String(value || '').trim());
}

export function validateEmailSendPayload(payload, maxAttachmentBytes) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Payload is required.' };
  }

  const documentType = sanitizeText(payload?.document?.documentType, 20).toLowerCase();
  const documentId = sanitizeText(payload?.document?.documentId, 80);
  const documentNumber = sanitizeText(payload?.document?.documentNumber, 80);

  if (!DOCUMENT_TYPE_SET.has(documentType)) {
    return { ok: false, error: 'Document type must be quote or invoice.' };
  }
  if (!documentId) return { ok: false, error: 'Document id is required.' };
  if (!documentNumber) return { ok: false, error: 'Document number is required.' };

  const to = sanitizeText(payload?.recipient?.to, 320);
  const cc = sanitizeText(payload?.recipient?.cc, 320);
  if (!isEmail(to)) return { ok: false, error: 'A valid recipient email is required.' };
  if (cc && !isEmail(cc)) return { ok: false, error: 'CC email is invalid.' };

  const subject = sanitizeText(payload.subject, 200);
  const bodyText = sanitizeText(payload.bodyText, 20000);
  if (!subject) return { ok: false, error: 'Subject is required.' };
  if (!bodyText) return { ok: false, error: 'Body is required.' };

  const rawFileName = sanitizeFilename(payload?.attachment?.fileName);
  const mimeType = sanitizeText(payload?.attachment?.mimeType, 120).toLowerCase();
  const contentBase64 = String(payload?.attachment?.contentBase64 || '').replace(/\s+/g, '');

  if (!rawFileName) return { ok: false, error: 'Attachment file name is required.' };
  if (mimeType !== 'application/pdf') {
    return { ok: false, error: 'Attachment mime type must be application/pdf.' };
  }
  if (!contentBase64) return { ok: false, error: 'Attachment content is required.' };
  if (!BASE64_PATTERN.test(contentBase64)) {
    return { ok: false, error: 'Attachment content is invalid base64.' };
  }

  const attachmentSizeBytes = estimateBase64SizeBytes(contentBase64);
  if (attachmentSizeBytes <= 0) {
    return { ok: false, error: 'Attachment content is empty.' };
  }
  if (attachmentSizeBytes > maxAttachmentBytes) {
    return { ok: false, error: 'Attachment exceeds configured size limit.' };
  }

  return {
    ok: true,
    data: {
      document: {
        documentType,
        documentId,
        documentNumber,
      },
      recipient: {
        to,
        cc: cc || undefined,
      },
      subject,
      bodyText,
      attachment: {
        fileName: rawFileName,
        mimeType: 'application/pdf',
        contentBase64,
        sizeBytes: attachmentSizeBytes,
      },
    },
  };
}
