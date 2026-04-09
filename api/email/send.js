import nodemailer from 'nodemailer';
import { getEmailCapabilities, getServerConfig, isRequestOriginAllowed } from '../_lib/config.js';
import { validateEmailSendPayload } from '../_lib/email-validation.js';

function safeError(code, message, status = 400) {
  return { code, message, status };
}

function buildFromAddress(smtp) {
  return `"${smtp.fromName}" <${smtp.fromEmail}>`;
}

async function sendWithNodemailer(config, payload) {
  const smtp = config.email.smtp;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  const info = await transporter.sendMail({
    from: buildFromAddress(smtp),
    to: payload.recipient.to,
    cc: payload.recipient.cc || undefined,
    subject: payload.subject,
    text: payload.bodyText,
    attachments: [
      {
        filename: payload.attachment.fileName,
        content: payload.attachment.contentBase64,
        encoding: 'base64',
        contentType: payload.attachment.mimeType,
      },
    ],
  });

  return {
    provider: 'nodemailer',
    messageId: info.messageId,
    sentAt: new Date().toISOString(),
  };
}

async function sendWithMock(payload) {
  return {
    provider: 'nodemailer-mock',
    messageId: `mock-${Date.now()}`,
    sentAt: new Date().toISOString(),
    simulatedRecipient: payload.recipient.to,
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

  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.toLowerCase().includes('application/json')) {
    res.status(415).json({
      ok: false,
      errorCode: 'UNSUPPORTED_MEDIA_TYPE',
      errorMessage: 'Content-Type must be application/json.',
    });
    return;
  }

  const config = getServerConfig();
  if (!isRequestOriginAllowed(req, config)) {
    res.status(403).json({
      ok: false,
      errorCode: 'ORIGIN_NOT_ALLOWED',
      errorMessage: 'Request origin is not allowed for this endpoint.',
    });
    return;
  }

  const capabilities = getEmailCapabilities(config);
  if (!capabilities.canSend) {
    res.status(503).json({
      ok: false,
      errorCode: 'EMAIL_NOT_CONFIGURED',
      errorMessage: capabilities.reason || 'Email transport is unavailable.',
    });
    return;
  }

  const validation = validateEmailSendPayload(req.body, config.email.maxAttachmentBytes);
  if (!validation.ok) {
    res.status(400).json({
      ok: false,
      errorCode: 'INVALID_REQUEST',
      errorMessage: validation.error,
    });
    return;
  }

  try {
    const payload = validation.data;
    const sendResult =
      capabilities.mode === 'mock'
        ? await sendWithMock(payload)
        : await sendWithNodemailer(config, payload);

    res.status(200).json({
      ok: true,
      provider: sendResult.provider,
      messageId: sendResult.messageId,
      sentAt: sendResult.sentAt,
    });
  } catch (error) {
    const safeMessage =
      config.runtime.isProductionLike
        ? 'Email delivery failed. Please retry or check server email configuration.'
        : error instanceof Error
          ? error.message
          : 'Failed to send email.';
    const normalized = safeError(
      'SMTP_SEND_FAILED',
      safeMessage,
      500,
    );

    res.status(normalized.status).json({
      ok: false,
      errorCode: normalized.code,
      errorMessage: normalized.message,
    });
  }
}
