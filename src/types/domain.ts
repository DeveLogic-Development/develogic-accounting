export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'converted';

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void';

export type TemplateStatus = 'draft' | 'published' | 'archived';
export type EmailStatus = 'sent' | 'failed' | 'queued' | 'bounced';

export interface ActivityEvent {
  id: string;
  action: string;
  actor: string;
  entity: string;
  timestamp: string;
  details?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  contactName: string;
  status: 'active' | 'inactive';
  totalBilled: number;
  outstandingBalance: number;
  lastActivityAt: string;
}

export interface ProductService {
  id: string;
  name: string;
  type: 'product' | 'service';
  sku: string;
  unitPrice: number;
  taxCategory: string;
  isActive: boolean;
  usageCount: number;
  description: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  clientId: string;
  clientName: string;
  status: QuoteStatus;
  issueDate: string;
  validUntil: string;
  total: number;
  templateName: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  total: number;
  balanceDue: number;
}

export interface DocumentLineItem {
  id: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountPercent: number;
}

export interface TemplateSummary {
  id: string;
  name: string;
  type: 'quote' | 'invoice';
  status: TemplateStatus;
  version: number;
  updatedAt: string;
  isDefault: boolean;
}

export interface EmailLog {
  id: string;
  documentNumber: string;
  recipientEmail: string;
  subject: string;
  status: EmailStatus;
  sentAt: string;
}

export interface PdfArchiveEntry {
  id: string;
  documentType: 'quote' | 'invoice';
  documentNumber: string;
  clientName: string;
  templateVersion: string;
  generatedAt: string;
  checksum: string;
}

export interface DashboardMetrics {
  totalOutstanding: number;
  overdueInvoices: number;
  draftQuotes: number;
  acceptedQuotesAwaitingConversion: number;
}
