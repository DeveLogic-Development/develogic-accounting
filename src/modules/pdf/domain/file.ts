import { PdfDocumentType, PdfFileMetadata } from './types';

function sanitizeDocumentNumber(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function buildPdfFileName(input: {
  documentType: PdfDocumentType;
  documentNumber: string;
  revision: number;
}): string {
  const safeNumber = sanitizeDocumentNumber(input.documentNumber);
  return `${input.documentType}-${safeNumber}-v${input.revision}.pdf`;
}

export function buildPdfStorageKey(input: {
  documentType: PdfDocumentType;
  documentId: string;
  fileName: string;
}): string {
  return `pdf/${input.documentType}/${input.documentId}/${input.fileName}`;
}

export function buildPdfFileMetadata(input: {
  documentType: PdfDocumentType;
  documentId: string;
  documentNumber: string;
  revision: number;
  sizeBytes: number;
  checksum: string;
  dataUrl: string;
}): PdfFileMetadata {
  const fileName = buildPdfFileName({
    documentType: input.documentType,
    documentNumber: input.documentNumber,
    revision: input.revision,
  });

  return {
    fileName,
    mimeType: 'application/pdf',
    sizeBytes: input.sizeBytes,
    checksum: input.checksum,
    storageKey: buildPdfStorageKey({
      documentType: input.documentType,
      documentId: input.documentId,
      fileName,
    }),
    dataUrl: input.dataUrl,
  };
}

export function computeDeterministicChecksum(bytes: Uint8Array): string {
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }

  const normalized = hash >>> 0;
  return normalized.toString(16).padStart(8, '0');
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function computeBlobChecksum(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return computeDeterministicChecksum(new Uint8Array(buffer));
}
