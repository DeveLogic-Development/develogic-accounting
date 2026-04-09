import { PdfArchiveRecord } from '@/modules/pdf/domain/types';
import { EmailComposeDraft, EmailTransportPayload } from './types';

export function extractBase64FromDataUrl(dataUrl: string): string | null {
  const separator = ';base64,';
  const index = dataUrl.indexOf(separator);
  if (index < 0) return null;
  return dataUrl.slice(index + separator.length);
}

export function buildEmailTransportPayload(input: {
  draft: EmailComposeDraft;
  attachmentRecord: PdfArchiveRecord;
}): EmailTransportPayload | null {
  const base64 = extractBase64FromDataUrl(input.attachmentRecord.file.dataUrl);
  if (!base64) return null;

  return {
    document: {
      documentType: input.draft.document.documentType,
      documentId: input.draft.document.documentId,
      documentNumber: input.draft.document.documentNumber,
    },
    recipient: input.draft.recipient,
    subject: input.draft.subject,
    bodyText: input.draft.body,
    attachment: {
      fileName: input.attachmentRecord.file.fileName,
      mimeType: input.attachmentRecord.file.mimeType,
      contentBase64: base64,
    },
  };
}
