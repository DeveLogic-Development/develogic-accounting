import { useNotificationsContext } from '../state/NotificationsContext';

export function useNotifications() {
  return useNotificationsContext();
}

