import { EmailSendResult, EmailTransportPayload } from '../domain/types';
import { summarizeEmailValidationIssues, validateTransportPayload } from '../domain/validation';

interface SendApiSuccessResponse {
  ok: true;
  messageId?: string;
  provider?: string;
  sentAt?: string;
}

interface SendApiFailureResponse {
  ok: false;
  errorCode?: string;
  errorMessage?: string;
}

type SendApiResponse = SendApiSuccessResponse | SendApiFailureResponse;

export async function sendEmailTransport(payload: EmailTransportPayload): Promise<EmailSendResult> {
  const attemptedAt = new Date().toISOString();

  const validation = validateTransportPayload(payload);
  if (!validation.isValid) {
    return {
      ok: false,
      attemptedAt,
      error: {
        code: 'INVALID_TRANSPORT_PAYLOAD',
        message: summarizeEmailValidationIssues(validation.issues),
      },
    };
  }

  try {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as SendApiResponse;
    if (!response.ok || !body.ok) {
      return {
        ok: false,
        attemptedAt,
        error: {
          code: body.ok ? 'EMAIL_SEND_FAILED' : body.errorCode ?? 'EMAIL_SEND_FAILED',
          message: body.ok ? 'Email send failed.' : body.errorMessage ?? 'Email send failed.',
        },
      };
    }

    return {
      ok: true,
      attemptedAt,
      sentAt: body.sentAt ?? attemptedAt,
      provider: body.provider ?? 'nodemailer',
      providerMessageId: body.messageId,
    };
  } catch (error) {
    return {
      ok: false,
      attemptedAt,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed.',
      },
    };
  }
}
