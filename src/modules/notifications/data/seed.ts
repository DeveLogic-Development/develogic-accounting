import { NotificationsState } from '../domain/types';

export function createNotificationSeedState(): NotificationsState {
  return {
    notifications: [],
  };
}

