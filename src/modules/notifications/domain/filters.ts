import { matchesSearchText } from '@/modules/insights/domain/filters';
import { isNotificationRead } from './helpers';
import {
  NotificationLevel,
  NotificationReadFilter,
  NotificationRecord,
  NotificationSource,
} from './types';

export interface NotificationFilters {
  read: NotificationReadFilter;
  level: 'all' | NotificationLevel;
  source: 'all' | NotificationSource;
  query: string;
}

export function matchesNotificationFilters(
  notification: NotificationRecord,
  filters: NotificationFilters,
): boolean {
  const readMatch =
    filters.read === 'all' ||
    (filters.read === 'read' && isNotificationRead(notification)) ||
    (filters.read === 'unread' && !isNotificationRead(notification));

  const levelMatch = filters.level === 'all' || notification.level === filters.level;
  const sourceMatch = filters.source === 'all' || notification.source === filters.source;
  const searchMatch = matchesSearchText(filters.query, [
    notification.title,
    notification.message,
    notification.source,
    notification.relatedEntityType ?? '',
    notification.relatedEntityId ?? '',
  ]);

  return readMatch && levelMatch && sourceMatch && searchMatch;
}

