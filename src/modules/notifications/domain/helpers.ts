import { createId } from '@/modules/accounting/domain/id';
import {
  NotificationCreateInput,
  NotificationEventInput,
  NotificationRecord,
  ToastCreateInput,
  ToastRecord,
} from './types';
import { resolveNotificationRoute } from './routes';

const DEFAULT_TOAST_DURATION_MS = 4200;

export function createNotificationRecord(
  input: NotificationCreateInput,
  nowIso: string = new Date().toISOString(),
): NotificationRecord {
  return {
    id: createId('notif'),
    level: input.level,
    title: input.title.trim(),
    message: input.message.trim(),
    source: input.source,
    createdAt: nowIso,
    route: input.route ?? resolveNotificationRoute(input),
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    actionLabel: input.actionLabel,
    dedupeKey: input.dedupeKey,
    metadata: input.metadata,
  };
}

export function createToastRecord(
  input: ToastCreateInput,
  nowIso: string = new Date().toISOString(),
): ToastRecord {
  return {
    id: createId('toast'),
    level: input.level,
    title: input.title?.trim() || undefined,
    message: input.message.trim(),
    createdAt: nowIso,
    durationMs: Math.max(1500, Math.round(input.durationMs ?? DEFAULT_TOAST_DURATION_MS)),
  };
}

export function shouldSuppressDuplicateNotification(input: {
  existing: NotificationRecord[];
  event: NotificationEventInput;
  nowIso: string;
  dedupeWindowMs?: number;
}): boolean {
  const dedupeKey = input.event.dedupeKey;
  if (!dedupeKey) return false;

  const nowMs = Date.parse(input.nowIso);
  const windowMs = Math.max(1000, Math.round(input.dedupeWindowMs ?? input.event.dedupeWindowMs ?? 45000));

  return input.existing.some((notification) => {
    if (notification.dedupeKey !== dedupeKey) return false;
    const ageMs = nowMs - Date.parse(notification.createdAt);
    return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= windowMs;
  });
}

export function markNotificationRead(notification: NotificationRecord, nowIso: string): NotificationRecord {
  if (notification.readAt) return notification;
  return {
    ...notification,
    readAt: nowIso,
  };
}

export function markNotificationUnread(notification: NotificationRecord): NotificationRecord {
  if (!notification.readAt) return notification;
  return {
    ...notification,
    readAt: undefined,
  };
}

export function isNotificationRead(notification: NotificationRecord): boolean {
  return Boolean(notification.readAt);
}

