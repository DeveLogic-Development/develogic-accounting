import { PdfArchiveState } from '../domain/types';

export interface PdfArchiveRepository {
  load(): PdfArchiveState | null;
  save(state: PdfArchiveState): void;
}
