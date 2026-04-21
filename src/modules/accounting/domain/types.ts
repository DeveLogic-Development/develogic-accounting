export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'converted';

export type InvoiceStatus =
  | 'draft'
  | 'approved'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void';

export type PaymentMethod = 'bank_transfer' | 'card' | 'cash' | 'mobile_money' | 'other';

export interface CurrencyAmount {
  currencyCode: string;
  amountMinor: number;
}

export interface TaxConfigurationReference {
  id: string;
  code: string;
  label: string;
  ratePercent: number;
  inclusive: boolean;
}

export interface StatusEvent<TStatus extends string> {
  id: string;
  status: TStatus;
  at: string;
  note?: string;
}

export interface DocumentTotals {
  subtotalMinor: number;
  lineDiscountMinor: number;
  documentDiscountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface DocumentPaymentSummary {
  paidMinor: number;
  outstandingMinor: number;
  derivedStatus: InvoiceStatus;
}

export interface BaseDocumentItem {
  id: string;
  productServiceId?: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountPercent: number;
  taxRatePercent: number;
  position: number;
}

export interface QuoteItem extends BaseDocumentItem {}
export interface InvoiceItem extends BaseDocumentItem {}

export interface Quote {
  id: string;
  quoteNumber: string;
  clientId: string;
  issueDate: string;
  expiryDate: string;
  currencyCode: string;
  status: QuoteStatus;
  templateId?: string;
  templateVersionId?: string;
  templateName?: string;
  notes: string;
  paymentTerms: string;
  internalMemo: string;
  items: QuoteItem[];
  documentDiscountPercent: number;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  convertedInvoiceId?: string;
  statusHistory: StatusEvent<QuoteStatus>[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  currencyCode: string;
  status: InvoiceStatus;
  templateId?: string;
  templateVersionId?: string;
  templateName?: string;
  notes: string;
  paymentTerms: string;
  internalMemo: string;
  items: InvoiceItem[];
  documentDiscountPercent: number;
  sourceQuoteId?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  voidedAt?: string;
  approvedAt?: string;
  statusHistory: StatusEvent<InvoiceStatus>[];
}

export interface Payment {
  id: string;
  invoiceId: string;
  amountMinor: number;
  paymentDate: string;
  method?: PaymentMethod;
  reference?: string;
  note?: string;
  createdAt: string;
}

export interface QuoteFormValues {
  clientId: string;
  issueDate: string;
  expiryDate: string;
  templateId?: string;
  templateVersionId?: string;
  templateName?: string;
  notes: string;
  paymentTerms: string;
  internalMemo: string;
  documentDiscountPercent: number;
  items: QuoteItemFormValues[];
}

export interface QuoteItemFormValues {
  id: string;
  productServiceId?: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRatePercent: number;
  position: number;
}

export interface InvoiceFormValues {
  clientId: string;
  issueDate: string;
  dueDate: string;
  templateId?: string;
  templateVersionId?: string;
  templateName?: string;
  notes: string;
  paymentTerms: string;
  internalMemo: string;
  documentDiscountPercent: number;
  items: InvoiceItemFormValues[];
}

export interface InvoiceItemFormValues {
  id: string;
  productServiceId?: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRatePercent: number;
  position: number;
}

export interface PaymentInput {
  amount: number;
  paymentDate: string;
  method?: PaymentMethod;
  reference?: string;
  note?: string;
}

export type QuoteCreatePayload = QuoteFormValues;
export type QuoteUpdatePayload = QuoteFormValues;
export type InvoiceCreatePayload = InvoiceFormValues;
export type InvoiceUpdatePayload = InvoiceFormValues;

export interface DocumentSnapshotReference {
  templateId?: string;
  templateName?: string;
  generatedAt?: string;
  pdfArchiveId?: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

export interface QuoteTransitionInput {
  quoteId: string;
  targetStatus: QuoteStatus;
  note?: string;
}

export interface InvoiceTransitionInput {
  invoiceId: string;
  targetStatus: InvoiceStatus;
  note?: string;
}

export interface QuoteSummary {
  id: string;
  quoteNumber: string;
  clientId: string;
  status: QuoteStatus;
  issueDate: string;
  expiryDate: string;
  totalMinor: number;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  clientId: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  totalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
}

export interface AccountingState {
  quotes: Quote[];
  invoices: Invoice[];
  payments: Payment[];
  quoteSequenceNext: number;
  invoiceSequenceNext: number;
}
