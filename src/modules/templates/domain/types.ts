export type DocumentTemplateType = 'quote' | 'invoice' | 'universal';
export type TemplateStatus = 'draft' | 'published' | 'archived';
export type TemplateVersionStatus = 'draft' | 'published';

export type TemplatePaperSize = 'a4' | 'letter';
export type TemplateHeaderLayout = 'standard' | 'split' | 'banner';
export type TemplateDocumentTitlePosition = 'header' | 'body';
export type TemplateDensity = 'comfortable' | 'compact';
export type TemplateSummaryPanelPosition = 'right' | 'bottom';
export type TemplateFooterLayout = 'minimal' | 'detailed' | 'legal';
export type TemplateFontFamily = 'manrope' | 'ibm_plex_sans' | 'source_serif_4';
export type TemplateLogoPlacement = 'left' | 'center' | 'right';
export type TemplateEmphasisStyle = 'subtle' | 'boxed' | 'bold';

export interface TemplateLayoutConfig {
  paperSize: TemplatePaperSize;
  headerLayout: TemplateHeaderLayout;
  documentTitlePosition: TemplateDocumentTitlePosition;
  density: TemplateDensity;
  summaryPanelPosition: TemplateSummaryPanelPosition;
  sectionSpacing: number;
  showSectionDividers: boolean;
  footerLayout: TemplateFooterLayout;
}

export interface TemplateBrandingConfig {
  logoAssetId?: string;
  logoUrl?: string;
  logoPlacement: TemplateLogoPlacement;
  primaryColor: string;
  accentColor: string;
  fontFamily: TemplateFontFamily;
  titleEmphasis: TemplateEmphasisStyle;
}

export interface TemplateSectionToggle {
  enabled: boolean;
  title: string;
}

export interface TemplateSectionConfig {
  businessDetails: TemplateSectionToggle;
  clientDetails: TemplateSectionToggle;
  metadata: TemplateSectionToggle;
  lineItems: TemplateSectionToggle;
  summary: TemplateSectionToggle;
  paymentTerms: TemplateSectionToggle;
  notes: TemplateSectionToggle;
  footer: TemplateSectionToggle;
}

export interface TemplateFieldVisibilityConfig {
  metadataFields: {
    showDocumentNumber: boolean;
    showIssueDate: boolean;
    showDueOrExpiryDate: boolean;
    showReference: boolean;
  };
  businessFields: {
    showRegistrationNumber: boolean;
    showTaxNumber: boolean;
    showContactEmail: boolean;
    showContactPhone: boolean;
  };
  clientFields: {
    showContactName: boolean;
    showEmail: boolean;
    showPhone: boolean;
  };
  summaryFields: {
    showSubtotal: boolean;
    showLineDiscount: boolean;
    showDocumentDiscount: boolean;
    showTax: boolean;
    showPaid: boolean;
    showOutstanding: boolean;
  };
}

export interface TemplateTableConfig {
  spacing: TemplateDensity;
  emphasizeTotal: TemplateEmphasisStyle;
  columns: {
    showDescription: boolean;
    showQuantity: boolean;
    showUnitPrice: boolean;
    showDiscount: boolean;
    showTax: boolean;
    showLineTotal: boolean;
  };
  labels: {
    item: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    tax: string;
    lineTotal: string;
  };
}

export interface TemplateSummaryConfig {
  alignment: 'left' | 'right';
  emphasizeTotal: TemplateEmphasisStyle;
  labels: {
    subtotal: string;
    lineDiscount: string;
    documentDiscount: string;
    tax: string;
    total: string;
    paid: string;
    outstanding: string;
  };
}

export interface TemplateFooterConfig {
  legalText: string;
  showCompanyStatement: boolean;
  showPaymentInstructions: boolean;
  paymentInstructionsLabel: string;
  paymentInstructionsText: string;
}

export interface TemplatePresetReference {
  id: string;
  name: string;
}

export interface TemplateConfig {
  layout: TemplateLayoutConfig;
  branding: TemplateBrandingConfig;
  sections: TemplateSectionConfig;
  fieldVisibility: TemplateFieldVisibilityConfig;
  table: TemplateTableConfig;
  summary: TemplateSummaryConfig;
  footer: TemplateFooterConfig;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  type: DocumentTemplateType;
  status: TemplateStatus;
  currentPublishedVersionId?: string;
  currentDraftVersionId?: string;
  latestVersionNumber: number;
  isDefaultForQuote: boolean;
  isDefaultForInvoice: boolean;
  preset?: TemplatePresetReference;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface DocumentTemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  status: TemplateVersionStatus;
  config: TemplateConfig;
  changeNote?: string;
  createdAt: string;
  publishedAt?: string;
}

export interface LogoAsset {
  id: string;
  name: string;
  url: string;
  kind: 'preset' | 'uploaded';
  createdAt: string;
}

export interface TemplateCreatePayload {
  name: string;
  description?: string;
  type: DocumentTemplateType;
  config: TemplateConfig;
  preset?: TemplatePresetReference;
}

export interface TemplateUpdateDraftPayload {
  templateId: string;
  config: TemplateConfig;
  changeNote?: string;
  name?: string;
  description?: string;
}

export interface TemplatePublishPayload {
  templateId: string;
  changeNote?: string;
}

export interface TemplateListRow {
  id: string;
  name: string;
  description: string;
  type: DocumentTemplateType;
  status: TemplateStatus;
  publishedVersionNumber?: number;
  draftVersionNumber?: number;
  updatedAt: string;
  isDefaultForQuote: boolean;
  isDefaultForInvoice: boolean;
}

export interface TemplateAssignmentReference {
  templateId: string;
  templateVersionId: string;
  templateName: string;
  templateVersionNumber: number;
}

export interface TemplatePreviewParty {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  addressLines: string[];
  registrationNumber?: string;
  taxNumber?: string;
}

export interface TemplatePreviewLineItem {
  id: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountPercent: number;
  taxRatePercent: number;
  lineTotalMinor: number;
}

export interface TemplatePreviewTotals {
  subtotalMinor: number;
  lineDiscountMinor: number;
  documentDiscountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor?: number;
  outstandingMinor?: number;
}

export interface TemplatePreviewPayload {
  documentType: 'quote' | 'invoice';
  documentTitle: string;
  documentNumber: string;
  issueDate: string;
  dueOrExpiryLabel: string;
  dueOrExpiryDate: string;
  business: TemplatePreviewParty;
  client: TemplatePreviewParty;
  reference?: string;
  notes?: string;
  paymentTerms?: string;
  lineItems: TemplatePreviewLineItem[];
  totals: TemplatePreviewTotals;
}

export interface TemplateValidationIssue {
  field: string;
  message: string;
}

export interface TemplateValidationResult {
  isValid: boolean;
  issues: TemplateValidationIssue[];
}

export interface TemplatesState {
  templates: DocumentTemplate[];
  versions: DocumentTemplateVersion[];
  logoAssets: LogoAsset[];
}
