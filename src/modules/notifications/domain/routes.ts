import { NotificationCreateInput, NotificationRecord } from './types';

export function resolveNotificationRoute(
  input: Pick<NotificationCreateInput, 'route' | 'relatedEntityType' | 'relatedEntityId'>,
): string | undefined {
  if (input.route) return input.route;
  if (!input.relatedEntityType || !input.relatedEntityId) return undefined;

  if (input.relatedEntityType === 'quote') return `/quotes/${input.relatedEntityId}`;
  if (input.relatedEntityType === 'invoice') return `/invoices/${input.relatedEntityId}`;
  if (input.relatedEntityType === 'template') return `/templates/${input.relatedEntityId}/editor`;
  if (input.relatedEntityType === 'pdf_archive') return '/pdf-archive';
  if (input.relatedEntityType === 'email_log') return '/emails/history';
  return undefined;
}

export function resolveRouteFromNotification(
  notification: Pick<NotificationRecord, 'route' | 'relatedEntityType' | 'relatedEntityId'>,
): string | undefined {
  return resolveNotificationRoute(notification);
}

