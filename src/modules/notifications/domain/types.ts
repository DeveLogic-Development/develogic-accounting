export type NotificationLevel = 'success' | 'info' | 'warning' | 'error';

export type NotificationSource =
  | 'quotes'
  | 'invoices'
  | 'payments'
  | 'templates'
  | 'pdf'
  | 'email'
  | 'settings'
  | 'system';

export type NotificationRelatedEntityType =
  | 'quote'
  | 'invoice'
  | 'payment'
  | 'template'
  | 'pdf_archive'
  | 'email_log';

export interface NotificationRecord {
  id: string;
  level: NotificationLevel;
  title: string;
  message: string;
  source: NotificationSource;
  createdAt: string;
  readAt?: string;
  route?: string;
  relatedEntityType?: NotificationRelatedEntityType;
  relatedEntityId?: string;
  actionLabel?: string;
  dedupeKey?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface NotificationCreateInput {
  level: NotificationLevel;
  title: string;
  message: string;
  source: NotificationSource;
  route?: string;
  relatedEntityType?: NotificationRelatedEntityType;
  relatedEntityId?: string;
  actionLabel?: string;
  dedupeKey?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface ToastRecord {
  id: string;
  level: NotificationLevel;
  title?: string;
  message: string;
  createdAt: string;
  durationMs: number;
}

export interface ToastCreateInput {
  level: NotificationLevel;
  title?: string;
  message: string;
  durationMs?: number;
}

export interface NotificationEventInput extends NotificationCreateInput {
  persistent?: boolean;
  toast?: boolean | Partial<ToastCreateInput>;
  dedupeWindowMs?: number;
}

export interface NotificationsState {
  notifications: NotificationRecord[];
}

export type NotificationReadFilter = 'all' | 'read' | 'unread';
