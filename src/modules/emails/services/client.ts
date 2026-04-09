import { appConfig } from '@/config/appConfig';
import { EmailCapability, EmailSendResult, EmailTransportPayload } from '../domain/types';
import { summarizeEmailValidationIssues, validateTransportPayload } from '../domain/validation';

interface SendApiSuccessResponse {
  ok: true;
  messageId?: string;
  provider?: string;
  sentAt?: string;
}

interface CapabilityApiSuccessResponse {
  ok: true;
  canSend: boolean;
  mode: 'smtp' | 'mock' | 'disabled';
  reason?: string;
  maxAttachmentBytes?: number;
}

interface CapabilityApiFailureResponse {
  ok: false;
  errorCode?: string;
  errorMessage?: string;
}

type CapabilityApiResponse = CapabilityApiSuccessResponse | CapabilityApiFailureResponse;

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

export async function fetchEmailCapability(): Promise<EmailCapability> {
  if (!appConfig.features.emailEnabled) {
    return {
      canSend: false,
      mode: 'disabled',
      reason: 'Email feature is disabled by client configuration.',
      source: 'fallback',
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const response = await fetch('/api/email/capabilities', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const body = (await response.json()) as CapabilityApiResponse;
    if (!response.ok || !body.ok) {
      return {
        canSend: false,
        mode: 'unknown',
        reason: body.ok ? 'Email capability check failed.' : body.errorMessage ?? 'Email capability unavailable.',
        source: 'server',
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      canSend: body.canSend,
      mode: body.mode,
      reason: body.reason,
      maxAttachmentBytes: body.maxAttachmentBytes,
      source: 'server',
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      canSend: false,
      mode: 'unknown',
      reason: 'Email API capability endpoint is unavailable in this environment.',
      source: 'fallback',
      checkedAt: new Date().toISOString(),
    };
  }
}
