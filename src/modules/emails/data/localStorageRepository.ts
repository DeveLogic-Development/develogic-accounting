import { EmailsState } from '../domain/types';
import { EmailsRepository } from './repository';

const STORAGE_KEY = 'develogic_email_state_v1';

export class LocalStorageEmailsRepository implements EmailsRepository {
  load(): EmailsState | null {
    if (typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as EmailsState;
    } catch {
      return null;
    }
  }

  save(state: EmailsState): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}
