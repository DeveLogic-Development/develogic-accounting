import { PdfArchiveState } from '../domain/types';

export function createPdfArchiveSeedState(): PdfArchiveState {
  return {
    records: [],
  };
}
