import { describe, expect, it } from 'vitest';
import {
  createNotificationRecord,
  createToastRecord,
  isNotificationRead,
  markNotificationRead,
  shouldSuppressDuplicateNotification,
} from '../helpers';
import { matchesNotificationFilters } from '../filters';
import { resolveRouteFromNotification } from '../routes';
import { NotificationRecord } from '../types';

function makeNotification(input: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: input.id ?? 'notif_1',
    level: input.level ?? 'info',
    title: input.title ?? 'Title',
    message: input.message ?? 'Message',
    source: input.source ?? 'system',
    createdAt: input.createdAt ?? '2026-04-09T09:00:00.000Z',
    route: input.route,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    dedupeKey: input.dedupeKey,
    readAt: input.readAt,
  };
}

describe('notification domain helpers', () => {
  it('creates notification records with trimmed strings and route mapping', () => {
    const record = createNotificationRecord(
      {
        level: 'success',
        source: 'quotes',
        title: '  Quote Accepted  ',
        message: '  Ready to convert. ',
        relatedEntityType: 'quote',
        relatedEntityId: 'q_1',
      },
      '2026-04-09T10:00:00.000Z',
    );

    expect(record.title).toBe('Quote Accepted');
    expect(record.message).toBe('Ready to convert.');
    expect(record.route).toBe('/quotes/q_1');
  });

  it('creates toasts with a minimum duration', () => {
    const toast = createToastRecord(
      {
        level: 'info',
        message: 'Saved',
        durationMs: 900,
      },
      '2026-04-09T10:00:00.000Z',
    );

    expect(toast.durationMs).toBe(1500);
  });

  it('suppresses duplicates by dedupe key in the configured time window', () => {
    const suppress = shouldSuppressDuplicateNotification({
      existing: [
        makeNotification({
          id: 'notif_prev',
          dedupeKey: 'invoice:inv_1:overdue',
          createdAt: '2026-04-09T09:59:40.000Z',
        }),
      ],
      event: {
        level: 'warning',
        source: 'invoices',
        title: 'Invoice Overdue',
        message: 'INV-00001 is overdue.',
        dedupeKey: 'invoice:inv_1:overdue',
      },
      nowIso: '2026-04-09T10:00:00.000Z',
      dedupeWindowMs: 60_000,
    });

    expect(suppress).toBe(true);
  });

  it('filters by read state, level, source, and search text', () => {
    const notification = makeNotification({
      level: 'error',
      source: 'email',
      title: 'Email Send Failed',
      message: 'SMTP timeout',
    });

    const matches = matchesNotificationFilters(notification, {
      read: 'unread',
      level: 'error',
      source: 'email',
      query: 'smtp',
    });

    expect(matches).toBe(true);
  });

  it('marks notifications as read and resolves link routes', () => {
    const unread = makeNotification({
      relatedEntityType: 'invoice',
      relatedEntityId: 'inv_2',
    });
    const read = markNotificationRead(unread, '2026-04-09T10:01:00.000Z');

    expect(isNotificationRead(read)).toBe(true);
    expect(resolveRouteFromNotification(read)).toBe('/invoices/inv_2');
  });
});
