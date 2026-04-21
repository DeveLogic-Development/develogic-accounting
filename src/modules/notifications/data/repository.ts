import { NotificationsState } from '../domain/types';

export interface NotificationsRepository {
  load(): NotificationsState | null;
  save(state: NotificationsState): void;
}

