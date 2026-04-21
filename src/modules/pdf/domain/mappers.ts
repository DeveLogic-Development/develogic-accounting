import { calculateDocumentTotals, deriveInvoicePaymentSummary } from '@/modules/accounting/domain/calculations';
import { Invoice, Quote } from '@/modules/accounting/domain/types';
import { BusinessSettings, splitAddressLines } from '@/modules/settings/domain/business-settings';
import { buildPreviewPayloadFromInvoice, buildPreviewPayloadFromQuote, buildPreviewRowsFromDomainItems } from '@/modules/templates/domain/preview-builders';
import { DocumentTemplate, DocumentTemplateVersion } from '@/modules/templates/domain/types';
import { DocumentRenderSnapshot, PdfDocumentType, PdfVersionContext } from './types';

interface SnapshotInputBase {
  capturedAt: string;
  template: DocumentTemplate;
  templateVersion: DocumentTemplateVersion;
  businessSettings?: BusinessSettings;
  client?: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    addressLines?: string[];
  };
}

export function mapQuoteToRenderSnapshot(input: SnapshotInputBase & { quote: Quote }): DocumentRenderSnapshot {
  const { quote, template, templateVersion, capturedAt, client, businessSettings } = input;
  const totals = calculateDocumentTotals(quote.items, quote.documentDiscountPercent);
  const templateConfig = {
    ...templateVersion.config,
    branding: {
      ...templateVersion.config.branding,
      primaryColor: businessSettings?.brandColor ?? templateVersion.config.branding.primaryColor,
      logoUrl: businessSettings?.logoDataUrl ?? templateVersion.config.branding.logoUrl,
      logoAssetId: businessSettings?.logoAssetId ?? templateVersion.config.branding.logoAssetId,
    },
  };
  const businessAddressLines = splitAddressLines(businessSettings?.address ?? '');

  return {
    renderSchemaVersion: 1,
    capturedAt,
    currencyCode: quote.currencyCode,
    documentReference: {
      documentType: 'quote',
      documentId: quote.id,
      documentNumber: quote.quoteNumber,
      documentStatus: quote.status,
    },
    template: {
      id: template.id,
      versionId: templateVersion.id,
      name: template.name,
      versionNumber: templateVersion.versionNumber,
      config: templateConfig,
    },
    previewPayload: buildPreviewPayloadFromQuote({
      quoteNumber: quote.quoteNumber,
      issueDate: quote.issueDate,
      expiryDate: quote.expiryDate,
      lineItems: buildPreviewRowsFromDomainItems(quote.items),
      totals,
      notes: quote.notes,
      paymentTerms: quote.paymentTerms,
      clientName: client?.name ?? quote.clientId,
      clientContactName: client?.contactName,
      clientEmail: client?.email,
      clientPhone: client?.phone,
      clientAddressLines: client?.addressLines,
      business: {
        name: businessSettings?.businessName ?? 'DeveLogic Digital',
        contactName: businessSettings?.senderName,
        email: businessSettings?.email,
        phone: businessSettings?.phone,
        addressLines: businessAddressLines.length > 0 ? businessAddressLines : undefined,
        registrationNumber: businessSettings?.registrationNumber,
        taxNumber: businessSettings?.vatNumber,
      },
    }),
  };
}

export function mapInvoiceToRenderSnapshot(input: SnapshotInputBase & { invoice: Invoice; payments: Array<{ invoiceId: string; amountMinor: number }> }): DocumentRenderSnapshot {
  const { invoice, template, templateVersion, payments, capturedAt, client, businessSettings } = input;
  const totals = calculateDocumentTotals(invoice.items, invoice.documentDiscountPercent);
  const paymentSummary = deriveInvoicePaymentSummary(invoice, payments, capturedAt);
  const templateConfig = {
    ...templateVersion.config,
    branding: {
      ...templateVersion.config.branding,
      primaryColor: businessSettings?.brandColor ?? templateVersion.config.branding.primaryColor,
      logoUrl: businessSettings?.logoDataUrl ?? templateVersion.config.branding.logoUrl,
      logoAssetId: businessSettings?.logoAssetId ?? templateVersion.config.branding.logoAssetId,
    },
  };
  const businessAddressLines = splitAddressLines(businessSettings?.address ?? '');

  return {
    renderSchemaVersion: 1,
    capturedAt,
    currencyCode: invoice.currencyCode,
    documentReference: {
      documentType: 'invoice',
      documentId: invoice.id,
      documentNumber: invoice.invoiceNumber,
      documentStatus: invoice.status,
    },
    template: {
      id: template.id,
      versionId: templateVersion.id,
      name: template.name,
      versionNumber: templateVersion.versionNumber,
      config: templateConfig,
    },
    previewPayload: buildPreviewPayloadFromInvoice({
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      lineItems: buildPreviewRowsFromDomainItems(invoice.items),
      totals,
      paidMinor: paymentSummary.paidMinor,
      outstandingMinor: paymentSummary.outstandingMinor,
      notes: invoice.notes,
      paymentTerms: invoice.paymentTerms,
      clientName: client?.name ?? invoice.clientId,
      clientContactName: client?.contactName,
      clientEmail: client?.email,
      clientPhone: client?.phone,
      clientAddressLines: client?.addressLines,
      business: {
        name: businessSettings?.businessName ?? 'DeveLogic Digital',
        contactName: businessSettings?.senderName,
        email: businessSettings?.email,
        phone: businessSettings?.phone,
        addressLines: businessAddressLines.length > 0 ? businessAddressLines : undefined,
        registrationNumber: businessSettings?.registrationNumber,
        taxNumber: businessSettings?.vatNumber,
      },
    }),
  };
}

export function mapTemplateContextForArchive(input: {
  template: DocumentTemplate;
  templateVersion: DocumentTemplateVersion;
}): PdfVersionContext {
  return {
    templateId: input.template.id,
    templateVersionId: input.templateVersion.id,
    templateName: input.template.name,
    templateVersionNumber: input.templateVersion.versionNumber,
  };
}

export function getDocumentTypeFromSnapshot(snapshot: DocumentRenderSnapshot): PdfDocumentType {
  return snapshot.documentReference.documentType;
}
