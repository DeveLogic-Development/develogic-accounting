import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/design-system/primitives/Button';
import { Badge } from '@/design-system/primitives/Badge';
import { formatDate } from '@/utils/format';
import { isNotificationRead } from '../domain/helpers';
import { resolveRouteFromNotification } from '../domain/routes';
import { NotificationRecord } from '../domain/types';
import { useNotifications } from '../hooks/useNotifications';

function levelToBadgeVariant(level: NotificationRecord['level']): 'success' | 'info' | 'warning' | 'danger' {
  if (level === 'success') return 'success';
  if (level === 'warning') return 'warning';
  if (level === 'error') return 'danger';
  return 'info';
}

export function NotificationsDropdown() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    getRecent,
    markAsRead,
    markAllAsRead,
    clearRead,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const recent = useMemo(() => getRecent(8), [getRecent, notifications]);
  const hasReadNotifications = notifications.length > unreadCount;

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const openNotification = (notification: NotificationRecord) => {
    markAsRead(notification.id);
    const route = resolveRouteFromNotification(notification);
    if (route) {
      navigate(route);
      setOpen(false);
    }
  };

  return (
    <div className="dl-notifications" ref={rootRef}>
      <button
        type="button"
        className="dl-icon-btn dl-notifications-trigger"
        aria-label="Open notifications"
        title="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 ? (
          <span className="dl-notifications-badge" aria-label={`${unreadCount} unread notifications`}>
            {Math.min(unreadCount, 99)}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className="dl-notifications-panel" aria-label="Notifications panel">
          <header className="dl-notifications-header">
            <div>
              <h3>Notifications</h3>
              <p>{unreadCount} unread</p>
            </div>
            <div className="dl-inline-actions">
              <Button
                size="sm"
                variant="ghost"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                title={unreadCount === 0 ? 'No unread notifications' : undefined}
              >
                Mark all read
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearRead}
                disabled={!hasReadNotifications}
                title={!hasReadNotifications ? 'No read notifications to clear' : undefined}
              >
                Clear read
              </Button>
            </div>
          </header>

          <div className="dl-notifications-list">
            {recent.length === 0 ? (
              <div className="dl-notifications-empty">
                <strong>No notifications yet</strong>
                <p>Important updates and alerts will appear here.</p>
              </div>
            ) : (
              recent.map((notification) => {
                const route = resolveRouteFromNotification(notification);
                const read = isNotificationRead(notification);
                return (
                  <article
                    key={notification.id}
                    className={`dl-notification-item ${read ? 'read' : 'unread'}`}
                  >
                    <button
                      type="button"
                      className="dl-notification-open"
                      onClick={() => openNotification(notification)}
                      disabled={!route}
                      title={!route ? 'No linked destination for this notification' : undefined}
                    >
                      <div className="dl-notification-item-head">
                        <strong>{notification.title}</strong>
                        <Badge variant={levelToBadgeVariant(notification.level)}>
                          {notification.level}
                        </Badge>
                      </div>
                      <p>{notification.message}</p>
                      <div className="dl-notification-meta">
                        <span>{notification.source}</span>
                        <span>{formatDate(notification.createdAt)}</span>
                      </div>
                    </button>
                    {!read ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsRead(notification.id)}
                      >
                        Mark read
                      </Button>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>

          <footer className="dl-notifications-footer">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              <Button size="sm" variant="secondary">View All Notifications</Button>
            </Link>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
