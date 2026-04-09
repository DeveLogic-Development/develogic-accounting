import { PdfArchiveState } from '../domain/types';
import { PdfArchiveRepository } from './repository';

const STORAGE_KEY = 'develogic_pdf_archive_state_v1';

export class LocalStoragePdfArchiveRepository implements PdfArchiveRepository {
  load(): PdfArchiveState | null {
    if (typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as PdfArchiveState;
    } catch {
      return null;
    }
  }

  save(state: PdfArchiveState): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}
