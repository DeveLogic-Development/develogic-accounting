import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { appConfig } from '@/config/appConfig';
import { canUseSupabaseRuntimeState, loadRuntimeState, saveRuntimeState } from '@/lib/supabase/runtime-state';
import { createNotificationSeedState } from '../data/seed';
import { LocalStorageNotificationsRepository } from '../data/localStorageRepository';
import {
  createNotificationRecord,
  createToastRecord,
  isNotificationRead,
  markNotificationRead,
  markNotificationUnread,
  shouldSuppressDuplicateNotification,
} from '../domain/helpers';
import {
  NotificationCreateInput,
  NotificationEventInput,
  NotificationRecord,
  NotificationsState,
  ToastCreateInput,
  ToastRecord,
} from '../domain/types';

interface NotificationsContextValue {
  state: NotificationsState;
  notifications: NotificationRecord[];
  toasts: ToastRecord[];
  unreadCount: number;
  getRecent: (limit?: number) => NotificationRecord[];
  getById: (id: string) => NotificationRecord | undefined;
  pushToast: (input: ToastCreateInput) => ToastRecord;
  dismissToast: (id: string) => void;
  createNotification: (input: NotificationCreateInput, options?: { dedupeWindowMs?: number }) => NotificationRecord | null;
  notify: (input: NotificationEventInput) => { notification: NotificationRecord | null; toast: ToastRecord | null };
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  markAllAsRead: () => void;
  clearRead: () => void;
  removeNotification: (id: string) => void;
}

const repository = new LocalStorageNotificationsRepository();
const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);
const REMOTE_STATE_KEY = 'notifications';

function isNotificationsState(value: unknown): value is NotificationsState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NotificationsState>;
  return Array.isArray(candidate.notifications);
}

function createInitialState(): NotificationsState {
  const loaded = repository.load();
  return isNotificationsState(loaded) ? loaded : createNotificationSeedState();
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NotificationsState>(createInitialState);
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [remoteHydrationComplete, setRemoteHydrationComplete] = useState(!canUseSupabaseRuntimeState());
  const toastTimersRef = useRef<Record<string, number>>({});

  useEffect(
    () => () => {
      Object.values(toastTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    },
    [],
  );

  const commit = (updater: (previous: NotificationsState) => NotificationsState) => {
    setState((previous) => {
      const next = updater(previous);
      repository.save(next);
      return next;
    });
  };

  const notifications = useMemo(
    () => state.notifications.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.notifications],
  );

  useEffect(() => {
    if (!canUseSupabaseRuntimeState()) return;

    let active = true;
    loadRuntimeState<NotificationsState>(REMOTE_STATE_KEY).then((result) => {
      if (!active) return;
      if (result.ok && result.data && isNotificationsState(result.data)) {
        setState(result.data);
      }
      setRemoteHydrationComplete(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!remoteHydrationComplete || !canUseSupabaseRuntimeState()) return;
    void saveRuntimeState(REMOTE_STATE_KEY, state);
  }, [remoteHydrationComplete, state]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !isNotificationRead(notification)).length,
    [notifications],
  );

  const dismissToast = (id: string) => {
    if (toastTimersRef.current[id]) {
      window.clearTimeout(toastTimersRef.current[id]);
      delete toastTimersRef.current[id];
    }
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  };

  const pushToast = (input: ToastCreateInput): ToastRecord => {
    const toast = createToastRecord(input);
    setToasts((previous) => [toast, ...previous].slice(0, 6));

    const timerId = window.setTimeout(() => {
      dismissToast(toast.id);
    }, toast.durationMs);
    toastTimersRef.current[toast.id] = timerId;
    return toast;
  };

  const createNotification = (
    input: NotificationCreateInput,
    options?: { dedupeWindowMs?: number },
  ): NotificationRecord | null => {
    const nowIso = new Date().toISOString();
    let created: NotificationRecord | null = null;

    commit((previous) => {
      const shouldSuppress = shouldSuppressDuplicateNotification({
        existing: previous.notifications,
        event: {
          ...input,
          persistent: true,
        },
        nowIso,
        dedupeWindowMs: options?.dedupeWindowMs,
      });
      if (shouldSuppress) return previous;

      created = createNotificationRecord(input, nowIso);
      return {
        ...previous,
        notifications: created ? [created, ...previous.notifications].slice(0, 600) : previous.notifications,
      };
    });

    return created;
  };

  const notify = (input: NotificationEventInput): { notification: NotificationRecord | null; toast: ToastRecord | null } => {
    const shouldPersist = input.persistent !== false;
    const shouldToast = input.toast === true || typeof input.toast === 'object';

    const notification = shouldPersist
      ? createNotification(
          {
            level: input.level,
            title: input.title,
            message: input.message,
            source: input.source,
            route: input.route,
            relatedEntityType: input.relatedEntityType,
            relatedEntityId: input.relatedEntityId,
            actionLabel: input.actionLabel,
            dedupeKey: input.dedupeKey,
            metadata: input.metadata,
          },
          { dedupeWindowMs: input.dedupeWindowMs },
        )
      : null;

    const toast = shouldToast
      ? pushToast({
          level: input.level,
          title: typeof input.toast === 'object' ? input.toast.title ?? input.title : input.title,
          message: typeof input.toast === 'object' ? input.toast.message ?? input.message : input.message,
          durationMs: typeof input.toast === 'object' ? input.toast.durationMs : undefined,
        })
      : null;

    return { notification, toast };
  };

  const contextValue: NotificationsContextValue = {
    state,
    notifications,
    toasts,
    unreadCount,
    getRecent: (limit = 8) => notifications.slice(0, Math.max(1, limit)),
    getById: (id) => notifications.find((notification) => notification.id === id),
    pushToast,
    dismissToast,
    createNotification,
    notify,
    markAsRead: (id) => {
      const nowIso = new Date().toISOString();
      commit((previous) => ({
        ...previous,
        notifications: previous.notifications.map((notification) =>
          notification.id === id ? markNotificationRead(notification, nowIso) : notification,
        ),
      }));
    },
    markAsUnread: (id) => {
      commit((previous) => ({
        ...previous,
        notifications: previous.notifications.map((notification) =>
          notification.id === id ? markNotificationUnread(notification) : notification,
        ),
      }));
    },
    markAllAsRead: () => {
      const nowIso = new Date().toISOString();
      commit((previous) => ({
        ...previous,
        notifications: previous.notifications.map((notification) => markNotificationRead(notification, nowIso)),
      }));
    },
    clearRead: () => {
      commit((previous) => ({
        ...previous,
        notifications: previous.notifications.filter((notification) => !isNotificationRead(notification)),
      }));
    },
    removeNotification: (id) => {
      commit((previous) => ({
        ...previous,
        notifications: previous.notifications.filter((notification) => notification.id !== id),
      }));
    },
  };

  useEffect(() => {
    appConfig.warnings.forEach((warning) => {
      createNotification(
        {
          level: 'warning',
          source: 'system',
          title: 'Configuration Warning',
          message: warning,
          route: '/settings/business',
          dedupeKey: `system-warning:${warning}`,
        },
        { dedupeWindowMs: 1000 * 60 * 60 * 24 * 30 },
      );
    });
  }, []);

  return <NotificationsContext.Provider value={contextValue}>{children}</NotificationsContext.Provider>;
}

export function useNotificationsContext(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotificationsContext must be used within NotificationsProvider');
  }
  return context;
}
