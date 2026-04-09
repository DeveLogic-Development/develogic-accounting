import { InvoiceStatus, QuoteStatus } from '@/modules/accounting/domain/types';
import { PdfArchiveRecord, PdfGenerationMode, PdfGenerationRequest } from './types';

interface GenerationPolicyResult {
  allowed: boolean;
  immutable: boolean;
  reason?: string;
}

export function evaluatePdfGenerationPolicy(input: {
  generationMode: PdfGenerationMode;
  documentStatus: QuoteStatus | InvoiceStatus;
}): GenerationPolicyResult {
  const { generationMode, documentStatus } = input;

  if (generationMode === 'draft_preview' && documentStatus !== 'draft') {
    return {
      allowed: false,
      immutable: false,
      reason: 'Draft preview generation is only allowed for draft documents.',
    };
  }

  return {
    allowed: true,
    immutable: generationMode !== 'draft_preview',
  };
}

export function getNextPdfRevision(records: PdfArchiveRecord[], input: { documentType: 'quote' | 'invoice'; documentId: string }): number {
  const existing = records.filter(
    (record) =>
      record.documentReference.documentType === input.documentType &&
      record.documentReference.documentId === input.documentId,
  );
  return existing.length + 1;
}

export function canRegenerateWithoutOverwrite(records: PdfArchiveRecord[], request: PdfGenerationRequest): GenerationPolicyResult {
  const nextRevision = getNextPdfRevision(records, {
    documentType: request.documentType,
    documentId: request.documentId,
  });

  if (nextRevision > 0) {
    return { allowed: true, immutable: request.generationMode !== 'draft_preview' };
  }

  return { allowed: true, immutable: request.generationMode !== 'draft_preview' };
}

export function selectLatestPdfRecord(
  records: PdfArchiveRecord[],
  input: { documentType: 'quote' | 'invoice'; documentId: string; immutableOnly?: boolean },
): PdfArchiveRecord | undefined {
  return records
    .filter(
      (record) =>
        record.documentReference.documentType === input.documentType &&
        record.documentReference.documentId === input.documentId &&
        (input.immutableOnly ? record.immutable : true),
    )
    .sort((a, b) => b.revision - a.revision)[0];
}
