import { NotificationsState } from '../domain/types';
import { NotificationsRepository } from './repository';

const STORAGE_KEY = 'develogic_notifications_state_v1';

export class LocalStorageNotificationsRepository implements NotificationsRepository {
  load(): NotificationsState | null {
    if (typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as NotificationsState;
    } catch {
      return null;
    }
  }

  save(state: NotificationsState): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

