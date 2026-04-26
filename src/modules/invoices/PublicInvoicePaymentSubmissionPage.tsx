import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Textarea } from '@/design-system/primitives/Textarea';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { formatDate, formatMinorCurrency } from '@/utils/format';
import { toSanitizedDecimalNumber } from '@/utils/numeric-input';

interface PublicPaymentContextInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  currencyCode: string;
  status: string;
  totalMinor: number;
  outstandingMinor: number;
  paymentReference: string;
}

interface PublicPaymentContextSettings {
  businessName: string;
  senderEmail: string;
  eftBankName: string;
  eftAccountHolder: string;
  eftAccountNumber: string;
  eftBranchCode: string;
  eftAccountType: string;
  eftSwiftBic?: string;
  eftInstructionNotes: string;
  eftProofAllowedMimeTypes: string[];
  eftProofMaxFileSizeBytes: number;
  eftEnabled: boolean;
  eftPublicSubmissionEnabled: boolean;
}

interface PublicPaymentContextPayload {
  token: string;
  source: 'database' | 'runtime_state';
  invoice: PublicPaymentContextInvoice;
  settings: PublicPaymentContextSettings;
  eligibility: {
    allowed: boolean;
    reason?: string;
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function formatMimeTypeLabel(value: string): string {
  if (value === 'application/pdf') return 'PDF';
  if (value === 'image/jpeg') return 'JPEG';
  if (value === 'image/png') return 'PNG';
  return value;
}

export function PublicInvoicePaymentSubmissionPage() {
  const { token } = useParams<{ token: string }>();
  const [contextPayload, setContextPayload] = useState<PublicPaymentContextPayload | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [submittedAmount, setSubmittedAmount] = useState<number>(0);
  const [submittedPaymentDate, setSubmittedPaymentDate] = useState('');
  const [submittedReference, setSubmittedReference] = useState('');
  const [message, setMessage] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSubmissionId, setCompletedSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setContextError('Payment link is invalid or has expired.');
      setLoadingContext(false);
      return () => {
        active = false;
      };
    }

    setLoadingContext(true);
    setContextError(null);

    void fetch(`/api/public/invoice-payment/context?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const body = (await response.json()) as
          | { ok: true; data: PublicPaymentContextPayload }
          | { ok: false; errorMessage?: string };
        if (!active) return;
        if (!response.ok || !body.ok) {
          setContextPayload(null);
          setContextError(
            body.ok
              ? 'Payment link is invalid or has expired.'
              : body.errorMessage ?? 'Payment link is invalid or has expired.',
          );
          return;
        }
        setContextPayload(body.data);
      })
      .catch(() => {
        if (!active) return;
        setContextPayload(null);
        setContextError('Unable to load payment link details. Please contact support.');
      })
      .finally(() => {
        if (active) setLoadingContext(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!contextPayload || submittedAmount > 0) return;
    const outstanding = contextPayload.invoice.outstandingMinor / 100;
    if (outstanding > 0) setSubmittedAmount(outstanding);
  }, [contextPayload, submittedAmount]);

  useEffect(() => {
    if (!contextPayload) return;
    const defaultReference = (
      contextPayload.invoice.invoiceNumber ||
      contextPayload.invoice.paymentReference
    ).trim();
    if (!defaultReference) return;
    setSubmittedReference((current) => (current.trim().length > 0 ? current : defaultReference));
  }, [
    contextPayload?.invoice.id,
    contextPayload?.invoice.invoiceNumber,
    contextPayload?.invoice.paymentReference,
  ]);

  const acceptedMimeTypes = useMemo(
    () => contextPayload?.settings.eftProofAllowedMimeTypes ?? ['application/pdf', 'image/jpeg', 'image/png'],
    [contextPayload?.settings.eftProofAllowedMimeTypes],
  );
  const acceptedMimeTypesLabel = acceptedMimeTypes.map((type) => formatMimeTypeLabel(type)).join(', ');
  const maxSizeMb = Math.max(
    1,
    Math.round((contextPayload?.settings.eftProofMaxFileSizeBytes ?? 10 * 1024 * 1024) / 1024 / 1024),
  );
  const canSubmit = contextPayload?.eligibility.allowed === true;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setNotice({ tone: 'error', text: 'Payment link is invalid or expired.' });
      return;
    }
    if (!contextPayload) {
      setNotice({ tone: 'error', text: 'Unable to load payment details for this link.' });
      return;
    }
    if (!canSubmit) {
      setNotice({ tone: 'warning', text: contextPayload.eligibility.reason ?? 'This invoice cannot accept submissions.' });
      return;
    }
    if (!proofFile) {
      setNotice({ tone: 'error', text: 'Please upload your proof of payment file before submitting.' });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    try {
      const dataUrl = await readFileAsDataUrl(proofFile);
      const response = await fetch('/api/public/invoice-payment/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          payerName,
          payerEmail,
          submittedAmount,
          submittedPaymentDate,
          submittedReference,
          note: message,
          proofFile: {
            fileName: proofFile.name,
            mimeType: proofFile.type || 'application/octet-stream',
            sizeBytes: proofFile.size,
            dataUrl,
          },
        }),
      });

      const body = (await response.json()) as
        | { ok: true; data?: { submissionId?: string } }
        | { ok: false; errorMessage?: string };

      if (!response.ok || !body.ok) {
        setNotice({
          tone: 'error',
          text: body.ok ? 'Unable to submit proof of payment.' : body.errorMessage ?? 'Unable to submit proof of payment.',
        });
        setIsSubmitting(false);
        return;
      }

      const submissionId = body.data?.submissionId ?? null;
      setCompletedSubmissionId(submissionId);
      setNotice({
        tone: 'success',
        text: 'Proof of payment submitted successfully. Our finance team will review and confirm your payment shortly.',
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to process the uploaded file.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="dl-page-stack" style={{ maxWidth: 860, margin: '40px auto', padding: '0 16px' }}>
        <EmptyState title="Payment link unavailable" description="This payment submission link is invalid." />
      </div>
    );
  }

  if (loadingContext) {
    return (
      <div className="dl-page-stack" style={{ maxWidth: 860, margin: '40px auto', padding: '0 16px' }}>
        <Card title="Loading payment details">
          <p className="dl-muted" style={{ margin: 0 }}>
            Validating your payment link...
          </p>
        </Card>
      </div>
    );
  }

  if (!contextPayload || contextError) {
    return (
      <div className="dl-page-stack" style={{ maxWidth: 860, margin: '40px auto', padding: '0 16px' }}>
        <EmptyState
          title="Payment link unavailable"
          description={contextError ?? 'This payment link is invalid or has expired.'}
        />
      </div>
    );
  }

  const invoice = contextPayload.invoice;
  const settings = contextPayload.settings;

  return (
    <main className="dl-page-stack" style={{ maxWidth: 900, margin: '30px auto', padding: '0 16px 40px' }}>
      <header>
        <h1 style={{ marginBottom: 8 }}>{settings.businessName}</h1>
        <p className="dl-muted" style={{ margin: 0 }}>
          Invoice payment submission portal
        </p>
      </header>

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}
      {!canSubmit ? <InlineNotice tone="warning">{contextPayload.eligibility.reason}</InlineNotice> : null}

      <div className="dl-grid cols-2">
        <Card title={`Invoice ${invoice.invoiceNumber}`} subtitle="Invoice payment details">
          <div className="dl-meta-grid">
            <div><strong>Customer:</strong> {invoice.clientName}</div>
            <div><strong>Invoice Date:</strong> {formatDate(invoice.issueDate)}</div>
            <div><strong>Due Date:</strong> {formatDate(invoice.dueDate)}</div>
            <div><strong>Invoice Total:</strong> {formatMinorCurrency(invoice.totalMinor, invoice.currencyCode)}</div>
            <div><strong>Outstanding:</strong> {formatMinorCurrency(invoice.outstandingMinor, invoice.currencyCode)}</div>
            <div><strong>Payment Reference:</strong> {invoice.paymentReference}</div>
          </div>
        </Card>

        <Card title="EFT Instructions" subtitle="Use these banking details for payment">
          <div className="dl-meta-grid">
            <div><strong>Bank:</strong> {settings.eftBankName}</div>
            <div><strong>Account Holder:</strong> {settings.eftAccountHolder}</div>
            <div><strong>Account Number:</strong> {settings.eftAccountNumber}</div>
            <div><strong>Branch Code:</strong> {settings.eftBranchCode}</div>
            <div><strong>Account Type:</strong> {settings.eftAccountType}</div>
            {settings.eftSwiftBic ? (
              <div><strong>SWIFT/BIC:</strong> {settings.eftSwiftBic}</div>
            ) : null}
            <div><strong>Reference:</strong> {invoice.paymentReference}</div>
          </div>
          {settings.eftInstructionNotes ? (
            <p className="dl-muted" style={{ marginTop: 12, marginBottom: 0 }}>
              {settings.eftInstructionNotes}
            </p>
          ) : null}
        </Card>
      </div>

      <Card title="Submit Proof of Payment" subtitle="Upload your EFT proof once payment has been made.">
        {completedSubmissionId ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <InlineNotice tone="success">
              Proof of payment submitted successfully. Reference ID: <strong>{completedSubmissionId}</strong>
            </InlineNotice>
            <p className="dl-muted" style={{ margin: 0 }}>
              You can close this page. If our team needs anything else, we will contact you.
            </p>
          </div>
        ) : (
          <form style={{ display: 'grid', gap: 12 }} onSubmit={(event) => void handleSubmit(event)}>
            <div className="dl-grid cols-2">
              <Input
                label="Payer Name"
                value={payerName}
                onChange={(event) => setPayerName(event.target.value)}
                placeholder="Name on payment confirmation"
              />
              <Input
                label="Payer Email"
                type="email"
                value={payerEmail}
                onChange={(event) => setPayerEmail(event.target.value)}
                placeholder="Optional email for payment follow-up"
              />
            </div>
            <div className="dl-grid cols-2">
              <Input
                label="Amount Paid"
                type="text"
                inputMode="decimal"
                value={submittedAmount}
                onChange={(event) => setSubmittedAmount(toSanitizedDecimalNumber(event.target.value))}
                required
              />
              <Input
                label="Payment Date"
                type="date"
                value={submittedPaymentDate}
                onChange={(event) => setSubmittedPaymentDate(event.target.value)}
                required
              />
            </div>
            <Input
              label="Payment Reference Used"
              value={submittedReference}
              onChange={(event) => setSubmittedReference(event.target.value)}
              placeholder={invoice.paymentReference}
            />
            <Textarea
              label="Message (optional)"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Any helpful details for finance review."
            />

            <div className="dl-form-group">
              <label className="dl-input-label">Proof of Payment File</label>
              <input
                type="file"
                accept={acceptedMimeTypes.join(',')}
                onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                required
              />
              <p className="dl-muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                Allowed: {acceptedMimeTypesLabel} · Max size: {maxSizeMb} MB
              </p>
            </div>

            <div className="dl-inline-actions" style={{ justifyContent: 'flex-end' }}>
              <Button type="submit" disabled={isSubmitting || !canSubmit}>
                {isSubmitting ? 'Submitting...' : 'Submit Proof of Payment'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <p className="dl-muted" style={{ fontSize: 12, marginBottom: 0 }}>
        Need assistance? Contact {settings.senderEmail || 'our finance team'}.
      </p>
    </main>
  );
}
