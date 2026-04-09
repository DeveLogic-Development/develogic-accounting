import { InvoiceStatus, QuoteStatus } from '@/modules/accounting/domain/types';
import { EmailDocumentType } from './types';

export function derivePostSendQuoteStatus(status: QuoteStatus): QuoteStatus | undefined {
  if (status === 'draft') return 'sent';
  return undefined;
}

export function derivePostSendInvoiceStatuses(status: InvoiceStatus): InvoiceStatus[] {
  if (status === 'draft') return ['approved'];
  if (status === 'approved') return ['sent'];
  return [];
}

export function canDocumentTypeSend(documentType: EmailDocumentType): boolean {
  return documentType === 'quote' || documentType === 'invoice';
}
