import { getEmailCapabilities, getServerConfig, isRequestOriginAllowed } from '../_lib/config.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({
      ok: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Only GET is allowed.',
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
  res.status(200).json({
    ok: true,
    canSend: capabilities.canSend,
    mode: capabilities.mode,
    reason: capabilities.reason,
    maxAttachmentBytes: config.email.maxAttachmentBytes,
  });
}
