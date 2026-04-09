function asBoolean(value, fallback) {
  if (value == null || String(value).trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function asNumber(value, fallback) {
  if (value == null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOrigins(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function getServerConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProductionLike = nodeEnv === 'production';
  const allowedOrigins = parseOrigins(process.env.APP_ALLOWED_ORIGINS);
  const emailMode =
    (process.env.EMAIL_TRANSPORT_MODE || '').trim().toLowerCase() ||
    (isProductionLike ? 'smtp' : 'mock');

  return {
    runtime: {
      nodeEnv,
      isProductionLike,
    },
    email: {
      mode: ['smtp', 'mock', 'disabled'].includes(emailMode) ? emailMode : 'mock',
      maxAttachmentBytes: Math.floor(asNumber(process.env.EMAIL_MAX_ATTACHMENT_MB, 5) * 1024 * 1024),
      smtp: {
        host: process.env.SMTP_HOST || '',
        port: asNumber(process.env.SMTP_PORT, 587),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        fromEmail: process.env.SMTP_FROM_EMAIL || '',
        fromName: process.env.SMTP_FROM_NAME || 'DeveLogic Accounting',
      },
    },
    security: {
      allowedOrigins,
      enforceOriginCheck: asBoolean(process.env.ENFORCE_EMAIL_ORIGIN_CHECK, false),
    },
  };
}

export function validateSmtpConfig(smtp) {
  if (!smtp.host.trim()) return 'SMTP_HOST is missing.';
  if (!smtp.port || !Number.isFinite(smtp.port)) return 'SMTP_PORT is invalid.';
  if (!smtp.fromEmail.trim()) return 'SMTP_FROM_EMAIL is missing.';
  return null;
}

export function getEmailCapabilities(config = getServerConfig()) {
  if (config.email.mode === 'disabled') {
    return {
      canSend: false,
      mode: 'disabled',
      reason: 'Email transport is disabled by configuration.',
    };
  }

  if (config.email.mode === 'mock') {
    return {
      canSend: true,
      mode: 'mock',
      reason: 'Mock email transport is active.',
    };
  }

  const smtpValidation = validateSmtpConfig(config.email.smtp);
  if (smtpValidation) {
    return {
      canSend: false,
      mode: 'smtp',
      reason: smtpValidation,
    };
  }

  return {
    canSend: true,
    mode: 'smtp',
  };
}

export function isRequestOriginAllowed(req, config = getServerConfig()) {
  if (!config.security.enforceOriginCheck) return true;
  if (!config.security.allowedOrigins.length) return true;
  const origin = req.headers.origin ? String(req.headers.origin).replace(/\/+$/, '') : '';
  if (!origin) return false;
  return config.security.allowedOrigins.includes(origin);
}
