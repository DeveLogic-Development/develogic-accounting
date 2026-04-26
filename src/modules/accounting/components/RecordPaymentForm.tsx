import { FormEvent, useState } from 'react';
import { Button } from '@/design-system/primitives/Button';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Textarea } from '@/design-system/primitives/Textarea';
import { InlineNotice } from '@/design-system/patterns/InlineNotice';
import { PaymentInput } from '../domain/types';
import { todayIsoDate } from '../domain/date';
import { toSanitizedDecimalNumber } from '@/utils/numeric-input';

interface RecordPaymentFormProps {
  onSubmit: (payload: PaymentInput) => { ok: boolean; error?: string };
  onCancel?: () => void;
}

export function RecordPaymentForm({ onSubmit, onCancel }: RecordPaymentFormProps) {
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(todayIsoDate());
  const [method, setMethod] = useState<PaymentInput['method']>('bank_transfer');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = onSubmit({
      amount,
      paymentDate,
      method: method || undefined,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });

    if (!result.ok) {
      setError(result.error ?? 'Unable to record payment.');
      return;
    }

    setError(null);
    setAmount(0);
    setReference('');
    setNote('');
    onCancel?.();
  };

  return (
    <form style={{ display: 'grid', gap: 12 }} onSubmit={handleSubmit}>
      <Input
        label="Amount"
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(toSanitizedDecimalNumber(event.target.value))}
      />
      <Input
        label="Payment Date"
        type="date"
        value={paymentDate}
        onChange={(event) => setPaymentDate(event.target.value)}
      />
      <Select
        label="Method"
        value={method ?? ''}
        onChange={(event) => setMethod((event.target.value || undefined) as PaymentInput['method'])}
        options={[
          { label: 'Bank Transfer', value: 'bank_transfer' },
          { label: 'Card', value: 'card' },
          { label: 'Cash', value: 'cash' },
          { label: 'Mobile Money', value: 'mobile_money' },
          { label: 'Other', value: 'other' },
        ]}
      />
      <Input
        label="Reference"
        value={reference}
        onChange={(event) => setReference(event.target.value)}
        placeholder="Optional payment reference"
      />
      <Textarea
        label="Note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note"
      />

      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

      <div className="dl-inline-actions" style={{ justifyContent: 'flex-end' }}>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary">
          Save Payment
        </Button>
      </div>
    </form>
  );
}
