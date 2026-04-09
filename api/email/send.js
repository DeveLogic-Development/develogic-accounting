import nodemailer from 'nodemailer';

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Payload is required.';
  if (!payload.document || typeof payload.document !== 'object') return 'Document reference is required.';
  if (!payload.recipient || typeof payload.recipient !== 'object') return 'Recipient details are required.';
  if (!isEmail(payload.recipient.to)) return 'A valid recipient email is required.';
  if (payload.recipient.cc && !isEmail(payload.recipient.cc)) return 'CC email is invalid.';
  if (!String(payload.subject || '').trim()) return 'Subject is required.';
  if (!String(payload.bodyText || '').trim()) return 'Email body is required.';
  if (!payload.attachment || typeof payload.attachment !== 'object') return 'Attachment is required.';
  if (!String(payload.attachment.fileName || '').trim()) return 'Attachment file name is required.';
  if (!String(payload.attachment.contentBase64 || '').trim()) return 'Attachment content is required.';
  return null;
}

function buildFromAddress() {
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'no-reply@develogic.accounting.local';
  const fromName = process.env.SMTP_FROM_NAME || 'DeveLogic Accounting';
  return `"${fromName}" <${fromEmail}>`;
}

async function sendWithTransport(payload) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const useMockTransport = process.env.EMAIL_TRANSPORT_MODE === 'mock' || !host;

  if (useMockTransport) {
    return {
      provider: 'nodemailer-mock',
      messageId: `mock-${Date.now()}`,
      sentAt: new Date().toISOString(),
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  const result = await transporter.sendMail({
    from: buildFromAddress(),
    to: payload.recipient.to,
    cc: payload.recipient.cc || undefined,
    subject: payload.subject,
    text: payload.bodyText,
    attachments: [
      {
        filename: payload.attachment.fileName,
        content: payload.attachment.contentBase64,
        encoding: 'base64',
        contentType: payload.attachment.mimeType || 'application/pdf',
      },
    ],
  });

  return {
    provider: 'nodemailer',
    messageId: result.messageId,
    sentAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({
      ok: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Only POST is allowed.',
    });
    return;
  }

  const validationError = validatePayload(req.body);
  if (validationError) {
    res.status(400).json({
      ok: false,
      errorCode: 'INVALID_REQUEST',
      errorMessage: validationError,
    });
    return;
  }

  try {
    const result = await sendWithTransport(req.body);
    res.status(200).json({
      ok: true,
      provider: result.provider,
      messageId: result.messageId,
      sentAt: result.sentAt,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      errorCode: 'SMTP_SEND_FAILED',
      errorMessage: error instanceof Error ? error.message : 'Failed to send email.',
    });
  }
}
