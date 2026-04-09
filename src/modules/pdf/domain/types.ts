import { TemplateConfig, TemplatePreviewPayload } from '@/modules/templates/domain/types';

export type PdfDocumentType = 'quote' | 'invoice';
export type PdfGenerationMode = 'draft_preview' | 'historical_archive' | 'manual_regeneration';
export type PdfStatus = 'generated' | 'failed';

export interface PdfSourceReference {
  source:
    | 'quote_detail'
    | 'invoice_detail'
    | 'quote_form'
    | 'invoice_form'
    | 'pdf_archive'
    | 'system';
  actor?: string;
}

export interface ArchivedDocumentReference {
  documentType: PdfDocumentType;
  documentId: string;
  documentNumber: string;
  documentStatus: string;
}

export interface PdfVersionContext {
  templateId: string;
  templateVersionId: string;
  templateName: string;
  templateVersionNumber: number;
}

export interface PdfFileMetadata {
  fileName: string;
  mimeType: 'application/pdf';
  sizeBytes: number;
  checksum: string;
  storageKey: string;
  dataUrl: string;
}

export interface DocumentRenderSnapshot {
  renderSchemaVersion: 1;
  capturedAt: string;
  documentReference: ArchivedDocumentReference;
  currencyCode: string;
  template: {
    id: string;
    versionId: string;
    name: string;
    versionNumber: number;
    config: TemplateConfig;
  };
  previewPayload: TemplatePreviewPayload;
}

export interface PdfArchiveRecord {
  id: string;
  revision: number;
  status: PdfStatus;
  generationMode: PdfGenerationMode;
  immutable: boolean;
  generatedAt: string;
  source: PdfSourceReference;
  documentReference: ArchivedDocumentReference;
  versionContext: PdfVersionContext;
  snapshot: DocumentRenderSnapshot;
  file: PdfFileMetadata;
}

export interface PdfArchiveListRow {
  id: string;
  documentType: PdfDocumentType;
  documentId: string;
  documentNumber: string;
  documentStatus: string;
  clientName: string;
  revision: number;
  generationMode: PdfGenerationMode;
  immutable: boolean;
  templateName: string;
  templateVersionNumber: number;
  generatedAt: string;
  fileName: string;
  sizeBytes: number;
  checksum: string;
}

export interface PdfGenerationRequest {
  documentType: PdfDocumentType;
  documentId: string;
  generationMode: PdfGenerationMode;
  source: PdfSourceReference;
}

export interface PdfGenerationResult {
  ok: boolean;
  error?: string;
  data?: PdfArchiveRecord;
}

export interface PdfArchiveState {
  records: PdfArchiveRecord[];
}
