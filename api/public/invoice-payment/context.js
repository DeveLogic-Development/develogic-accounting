import { resolvePublicInvoicePaymentContext } from '../../_lib/public-invoice-payment.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({
      ok: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Only GET is allowed.',
    });
    return;
  }

  const token = String(req.query?.token || '').trim();
  const result = await resolvePublicInvoicePaymentContext(token);

  if (!result.ok) {
    res.status(result.status || 400).json({
      ok: false,
      errorCode: 'PAYMENT_LINK_UNAVAILABLE',
      errorMessage: result.error || 'Payment link is invalid or has expired.',
    });
    return;
  }

  res.status(200).json({
    ok: true,
    data: result.data,
  });
}
