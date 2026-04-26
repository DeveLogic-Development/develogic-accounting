import { submitPublicInvoicePaymentProof } from '../../_lib/public-invoice-payment.js';

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

  const token = String(req.body?.token || '').trim();
  const result = await submitPublicInvoicePaymentProof(token, req.body);

  if (!result.ok) {
    res.status(result.status || 400).json({
      ok: false,
      errorCode: 'PAYMENT_SUBMISSION_FAILED',
      errorMessage: result.error || 'Unable to submit proof of payment.',
    });
    return;
  }

  res.status(200).json({
    ok: true,
    data: result.data,
  });
}
