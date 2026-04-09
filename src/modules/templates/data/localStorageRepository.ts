import { TemplatesState } from '../domain/types';
import { TemplatesRepository } from './repository';

const STORAGE_KEY = 'develogic_templates_state_v1';

export class LocalStorageTemplatesRepository implements TemplatesRepository {
  load(): TemplatesState | null {
    if (typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as TemplatesState;
    } catch {
      return null;
    }
  }

  save(state: TemplatesState): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}
