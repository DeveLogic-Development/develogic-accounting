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
export type RecurringInvoiceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type RecurringInvoiceStatus = 'draft' | 'active' | 'paused';
export type InvoicePaymentSubmissionStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'cancelled';
export type InvoicePaymentSubmissionState = 'none' | 'submitted' | 'under_review' | 'rejected' | 'approved';

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
  adjustmentMinor: number;
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

export interface QuoteAddressSnapshot {
  attention?: string;
  line1?: string;
  line2?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  countryRegion?: string;
}

export interface QuoteAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  dataUrl?: string;
  storageKey?: string;
}

export type InvoiceAddressSnapshot = QuoteAddressSnapshot;
export type InvoiceAttachment = QuoteAttachment;

export interface InvoicePaymentProofFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  dataUrl?: string;
  storageKey?: string;
}

export interface InvoiceActivityEvent {
  id: string;
  event:
    | 'created'
    | 'updated'
    | 'status_changed'
    | 'attachment_added'
    | 'attachment_removed'
    | 'emailed'
    | 'payment_recorded'
    | 'duplicated'
    | 'voided'
    | 'deleted'
    | 'recurring_requested'
    | 'credit_note_requested'
    | 'payment_submission_created'
    | 'payment_submission_reviewed'
    | 'payment_submission_approved'
    | 'payment_submission_rejected';
  at: string;
  actor?: string;
  message: string;
}

export interface QuoteComment {
  id: string;
  body: string;
  createdAt: string;
  createdBy?: string;
}

export interface QuoteActivityEvent {
  id: string;
  event:
    | 'created'
    | 'updated'
    | 'status_changed'
    | 'comment_added'
    | 'attachment_added'
    | 'attachment_removed'
    | 'emailed'
    | 'converted'
    | 'duplicated'
    | 'deleted';
  at: string;
  actor?: string;
  message: string;
}

export interface QuoteConversionPreferences {
  carryCustomerNotes: boolean;
  carryTermsAndConditions: boolean;
  carryAddresses: boolean;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  referenceNumber?: string;
  salesperson?: string;
  projectName?: string;
  subject?: string;
  clientId: string;
  issueDate: string;
  expiryDate: string;
  currencyCode: string;
  status: QuoteStatus;
  templateId?: string;
  templateVersionId?: string;
  templateName?: string;
  notes: string;
  termsAndConditions?: string;
  paymentTerms: string;
  internalMemo: string;
  adjustmentMinor?: number;
  recipientEmails?: string[];
  billingAddressSnapshot?: QuoteAddressSnapshot;
  shippingAddressSnapshot?: QuoteAddressSnapshot;
  comments?: QuoteComment[];
  attachments?: QuoteAttachment[];
  activityLog?: QuoteActivityEvent[];
  conversionPreferences?: QuoteConversionPreferences;
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
  orderNumber?: string;
  accountsReceivableAccountId?: string;
  salesperson?: string;
  subject?: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  terms: string;
  currencyCode: string;
  status: InvoiceStatus;
  templateId?: string;
  templateVersionId?: string;
  templateName?: string;
  notes: string;
  paymentTerms: string;
  termsAndConditions?: string;
  internalMemo: string;
  recipientEmails?: string[];
  eftPaymentReference?: string;
  publicPaymentToken?: string;
  publicPaymentEnabled?: boolean;
  billingAddressSnapshot?: InvoiceAddressSnapshot;
  shippingAddressSnapshot?: InvoiceAddressSnapshot;
  attachments?: InvoiceAttachment[];
  activityLog?: InvoiceActivityEvent[];
  items: InvoiceItem[];
  adjustmentMinor?: number;
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

export interface InvoicePaymentSubmission {
  id: string;
  invoiceId: string;
  clientId: string;
  publicToken: string;
  status: InvoicePaymentSubmissionStatus;
  payerName?: string;
  payerEmail?: string;
  submittedAmountMinor: number;
  submittedPaymentDate: string;
  submittedReference?: string;
  note?: string;
  proofFile: InvoicePaymentProofFile;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteFormValues {
  quoteNumber?: string;
  referenceNumber?: string;
  salesperson?: string;
  projectName?: string;
  subject?: string;
  clientId: string;
  issueDate: string;
  expiryDate: string;
  templateId?: string;
  templateVersionId?: string;
  templateName?: string;
  notes: string;
  termsAndConditions?: string;
  paymentTerms: string;
  internalMemo: string;
  adjustment?: number;
  recipientEmails?: string[];
  billingAddressSnapshot?: QuoteAddressSnapshot;
  shippingAddressSnapshot?: QuoteAddressSnapshot;
  attachments?: QuoteAttachment[];
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
  invoiceNumber?: string;
  orderNumber?: string;
  accountsReceivableAccountId?: string;
  salesperson?: string;
  subject?: string;
  clientId: string;
  issueDate: string;
  terms: string;
  dueDate: string;
  templateId?: string;
  templateVersionId?: string;
  templateName?: string;
  notes: string;
  paymentTerms: string;
  termsAndConditions?: string;
  internalMemo: string;
  adjustment?: number;
  recipientEmails?: string[];
  billingAddressSnapshot?: InvoiceAddressSnapshot;
  shippingAddressSnapshot?: InvoiceAddressSnapshot;
  attachments?: InvoiceAttachment[];
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

export interface InvoicePaymentSubmissionPublicInput {
  publicToken: string;
  payerName?: string;
  payerEmail?: string;
  submittedAmount: number;
  submittedPaymentDate: string;
  submittedReference?: string;
  note?: string;
  proofFile: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    dataUrl?: string;
    storageKey?: string;
  };
}

export interface InvoicePaymentSubmissionReviewInput {
  status: Extract<InvoicePaymentSubmissionStatus, 'under_review' | 'approved' | 'rejected' | 'cancelled'>;
  reviewNotes?: string;
  approvedAmount?: number;
  approvedPaymentDate?: string;
  approvedPaymentReference?: string;
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
  referenceNumber?: string;
  clientId: string;
  status: QuoteStatus;
  issueDate: string;
  expiryDate: string;
  totalMinor: number;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  orderNumber?: string;
  clientId: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  totalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  terms?: string;
  salesperson?: string;
  paymentSubmissionState?: InvoicePaymentSubmissionState;
  pendingSubmissionCount?: number;
  latestSubmissionAt?: string;
}

export interface RecurringInvoiceProfile {
  id: string;
  sourceInvoiceId: string;
  sourceInvoiceNumber: string;
  clientId: string;
  profileName: string;
  frequency: RecurringInvoiceFrequency;
  interval: number;
  startDate: string;
  nextRunDate: string;
  endDate?: string;
  autoSend: boolean;
  status: RecurringInvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingState {
  quotes: Quote[];
  invoices: Invoice[];
  payments: Payment[];
  paymentSubmissions: InvoicePaymentSubmission[];
  recurringInvoiceProfiles: RecurringInvoiceProfile[];
  quoteSequenceNext: number;
  invoiceSequenceNext: number;
}
