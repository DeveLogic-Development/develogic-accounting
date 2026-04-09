import { AccountingRepository } from './repository';
import { AccountingState } from '../domain/types';

const STORAGE_KEY = 'develogic_accounting_state_v1';

export class LocalStorageAccountingRepository implements AccountingRepository {
  load(): AccountingState | null {
    if (typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AccountingState;
    } catch {
      return null;
    }
  }

  save(state: AccountingState): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}
