import { PdfArchiveRecord, PdfGenerationResult } from '@/modules/pdf/domain/types';
import { EmailAttachmentReference } from './types';

interface ResolveAttachmentInput {
  documentType: 'quote' | 'invoice';
  documentId: string;
  preferredRecordId?: string;
  resendAttachmentRecordId?: string;
  getRecordById: (recordId: string) => PdfArchiveRecord | undefined;
  getLatestImmutableRecord: (input: { documentType: 'quote' | 'invoice'; documentId: string }) => PdfArchiveRecord | undefined;
  generateHistoricalArchive: () => Promise<PdfGenerationResult>;
}

interface ResolveAttachmentResult {
  ok: boolean;
  error?: string;
  record?: PdfArchiveRecord;
  generated?: boolean;
}

function matchesDocument(record: PdfArchiveRecord, documentType: 'quote' | 'invoice', documentId: string): boolean {
  return (
    record.documentReference.documentType === documentType &&
    record.documentReference.documentId === documentId
  );
}

export async function resolveAttachmentRecordForSend(
  input: ResolveAttachmentInput,
): Promise<ResolveAttachmentResult> {
  if (input.resendAttachmentRecordId) {
    const resendRecord = input.getRecordById(input.resendAttachmentRecordId);
    if (resendRecord && matchesDocument(resendRecord, input.documentType, input.documentId)) {
      return { ok: true, record: resendRecord };
    }
  }

  if (input.preferredRecordId) {
    const preferredRecord = input.getRecordById(input.preferredRecordId);
    if (preferredRecord && matchesDocument(preferredRecord, input.documentType, input.documentId)) {
      return { ok: true, record: preferredRecord };
    }
  }

  const latestImmutable = input.getLatestImmutableRecord({
    documentType: input.documentType,
    documentId: input.documentId,
  });
  if (latestImmutable) {
    return { ok: true, record: latestImmutable };
  }

  const generated = await input.generateHistoricalArchive();
  if (!generated.ok || !generated.data) {
    return {
      ok: false,
      error: generated.error ?? 'Unable to generate an archived PDF attachment for email.',
    };
  }

  if (!matchesDocument(generated.data, input.documentType, input.documentId)) {
    return { ok: false, error: 'Generated PDF archive record does not match document reference.' };
  }

  return { ok: true, record: generated.data, generated: true };
}

export function mapPdfRecordToAttachmentReference(record: PdfArchiveRecord): EmailAttachmentReference {
  return {
    pdfArchiveRecordId: record.id,
    fileName: record.file.fileName,
    mimeType: record.file.mimeType,
    storageKey: record.file.storageKey,
    checksum: record.file.checksum,
    sizeBytes: record.file.sizeBytes,
    revision: record.revision,
    immutable: record.immutable,
    templateId: record.versionContext.templateId,
    templateVersionId: record.versionContext.templateVersionId,
    templateName: record.versionContext.templateName,
    templateVersionNumber: record.versionContext.templateVersionNumber,
  };
}
