import nodemailer from 'nodemailer';
import { getEmailCapabilities, getServerConfig, isRequestOriginAllowed } from '../_lib/config.js';
import { validateEmailSendPayload } from '../_lib/email-validation.js';

function safeError(code, message, status = 400) {
  return { code, message, status };
}

function buildFromAddress(smtp) {
  return `"${smtp.fromName}" <${smtp.fromEmail}>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractProofOfPaymentUrl(bodyText) {
  const text = String(bodyText || '');
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const labelIndex = lines.findIndex((line) =>
    /^upload proof of payment:$/i.test(line) || /^submit proof of payment:$/i.test(line),
  );
  if (labelIndex >= 0) {
    for (let index = labelIndex + 1; index < lines.length; index += 1) {
      const candidate = lines[index];
      if (!candidate) continue;
      const match = candidate.match(/^https?:\/\/[^\s]+$/i);
      if (match) return match[0];
      break;
    }
  }

  const fallbackMatch = text.match(/https?:\/\/[^\s]+/i);
  return fallbackMatch ? fallbackMatch[0] : undefined;
}

function buildEmailHtml(bodyText) {
  const lines = String(bodyText || '').split(/\r?\n/);
  const url = extractProofOfPaymentUrl(bodyText);
  const escapedBody = lines
    .map((line) => escapeHtml(line))
    .join('<br/>');

  if (!url) {
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;">${escapedBody}</div>`;
  }

  const safeUrl = escapeHtml(url);
  const buttonHtml = `
    <div style="margin:16px 0;">
      <a
        href="${safeUrl}"
        target="_blank"
        rel="noopener noreferrer"
        style="display:inline-block;padding:12px 18px;background:#174B7A;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;"
      >
        Upload Proof of Payment
      </a>
    </div>
  `;

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;">${escapedBody}${buttonHtml}</div>`;
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
    html: buildEmailHtml(payload.bodyText),
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
    const sendResult = await sendWithNodemailer(config, payload);

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
