import { describe, expect, it } from 'vitest';
import { derivePostSendInvoiceStatuses, derivePostSendQuoteStatus } from '../workflow';

describe('post-send status workflow', () => {
  it('marks draft quotes as sent after successful email send', () => {
    expect(derivePostSendQuoteStatus('draft')).toBe('sent');
    expect(derivePostSendQuoteStatus('accepted')).toBeUndefined();
  });

  it('moves draft invoices to approved/open after successful send', () => {
    expect(derivePostSendInvoiceStatuses('draft')).toEqual(['approved']);
  });

  it('only moves approved invoices to sent', () => {
    expect(derivePostSendInvoiceStatuses('approved')).toEqual(['sent']);
    expect(derivePostSendInvoiceStatuses('paid')).toEqual([]);
  });
});
