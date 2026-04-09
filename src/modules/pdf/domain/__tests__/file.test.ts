import { describe, expect, it } from 'vitest';
import {
  buildPdfFileMetadata,
  buildPdfFileName,
  buildPdfStorageKey,
  computeDeterministicChecksum,
} from '../file';

describe('pdf file helpers', () => {
  it('builds stable file names from document type, number, and revision', () => {
    expect(
      buildPdfFileName({
        documentType: 'quote',
        documentNumber: 'QT-2026-0012',
        revision: 1,
      }),
    ).toBe('quote-qt-2026-0012-v1.pdf');
  });

  it('builds stable storage keys', () => {
    expect(
      buildPdfStorageKey({
        documentType: 'invoice',
        documentId: 'inv_123',
        fileName: 'invoice-inv-0001-v2.pdf',
      }),
    ).toBe('pdf/invoice/inv_123/invoice-inv-0001-v2.pdf');
  });

  it('builds archive metadata with naming and storage conventions', () => {
    const metadata = buildPdfFileMetadata({
      documentType: 'invoice',
      documentId: 'inv_456',
      documentNumber: 'INV-2026-0048',
      revision: 2,
      sizeBytes: 4096,
      checksum: 'deadbeef',
      dataUrl: 'data:application/pdf;base64,abc',
    });

    expect(metadata.fileName).toBe('invoice-inv-2026-0048-v2.pdf');
    expect(metadata.storageKey).toBe('pdf/invoice/inv_456/invoice-inv-2026-0048-v2.pdf');
    expect(metadata.sizeBytes).toBe(4096);
    expect(metadata.checksum).toBe('deadbeef');
  });

  it('computes deterministic checksums from bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const checksumA = computeDeterministicChecksum(bytes);
    const checksumB = computeDeterministicChecksum(bytes);

    expect(checksumA).toBe(checksumB);
    expect(checksumA).toMatch(/^[a-f0-9]{8}$/);
  });
});
