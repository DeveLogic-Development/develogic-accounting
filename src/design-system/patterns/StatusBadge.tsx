import { Badge, BadgeVariant } from '@/design-system/primitives/Badge';
import {
  EmailStatus,
  InvoiceStatus as LegacyInvoiceStatus,
  QuoteStatus as LegacyQuoteStatus,
  TemplateStatus,
} from '@/types/domain';
import {
  InvoiceStatus as DomainInvoiceStatus,
  QuoteStatus as DomainQuoteStatus,
} from '@/modules/accounting/domain/types';
import { EmailLogStatus } from '@/modules/emails/domain/types';

type QuoteStatus = LegacyQuoteStatus | DomainQuoteStatus;
type InvoiceStatus = LegacyInvoiceStatus | DomainInvoiceStatus;
type EmailStatusValue = EmailStatus | EmailLogStatus;

function getQuoteVariant(status: QuoteStatus): BadgeVariant {
  switch (status) {
    case 'accepted':
      return 'success';
    case 'rejected':
    case 'declined':
      return 'danger';
    case 'expired':
      return 'warning';
    case 'converted':
      return 'accent';
    case 'sent':
    case 'viewed':
      return 'info';
    default:
      return 'neutral';
  }
}

function getInvoiceVariant(status: InvoiceStatus): BadgeVariant {
  switch (status) {
    case 'paid':
      return 'success';
    case 'overdue':
      return 'danger';
    case 'partially_paid':
      return 'warning';
    case 'approved':
    case 'issued':
    case 'sent':
    case 'viewed':
      return 'info';
    default:
      return 'neutral';
  }
}

function getTemplateVariant(status: TemplateStatus): BadgeVariant {
  switch (status) {
    case 'published':
      return 'success';
    case 'archived':
      return 'warning';
    default:
      return 'neutral';
  }
}

function getEmailVariant(status: EmailStatusValue): BadgeVariant {
  switch (status) {
    case 'sent':
      return 'success';
    case 'sending':
      return 'info';
    case 'failed':
    case 'cancelled':
    case 'bounced':
      return 'danger';
    default:
      return 'warning';
  }
}

const labelMap: Record<string, string> = {
  partially_paid: 'Partially Paid',
};

function prettyLabel(status: string): string {
  return labelMap[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge variant={getQuoteVariant(status)}>{prettyLabel(status)}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={getInvoiceVariant(status)}>{prettyLabel(status)}</Badge>;
}

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  return <Badge variant={getTemplateVariant(status)}>{prettyLabel(status)}</Badge>;
}

export function EmailStatusBadge({ status }: { status: EmailStatusValue }) {
  return <Badge variant={getEmailVariant(status)}>{prettyLabel(status)}</Badge>;
}
