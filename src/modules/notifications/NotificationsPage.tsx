import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { Badge } from '@/design-system/primitives/Badge';
import { Button } from '@/design-system/primitives/Button';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { formatDate, formatRelativeDate } from '@/utils/format';
import { isNotificationRead } from './domain/helpers';
import { matchesNotificationFilters } from './domain/filters';
import { resolveRouteFromNotification } from './domain/routes';
import { NotificationLevel, NotificationReadFilter, NotificationSource } from './domain/types';
import { useNotifications } from './hooks/useNotifications';

function levelVariant(level: NotificationLevel): 'success' | 'info' | 'warning' | 'danger' {
  if (level === 'success') return 'success';
  if (level === 'warning') return 'warning';
  if (level === 'error') return 'danger';
  return 'info';
}

function sourceLabel(source: NotificationSource): string {
  if (source === 'pdf') return 'PDF';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    clearRead,
    removeNotification,
  } = useNotifications();
  const [read, setRead] = useState<NotificationReadFilter>('all');
  const [level, setLevel] = useState<'all' | NotificationLevel>('all');
  const [source, setSource] = useState<'all' | NotificationSource>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
      notifications.filter((notification) =>
        matchesNotificationFilters(notification, {
          read,
          level,
          source,
          query,
        }),
      ),
    [level, notifications, query, read, source],
  );

  const hasRead = notifications.length > unreadCount;

  const openNotification = (notificationId: string) => {
    const notification = notifications.find((entry) => entry.id === notificationId);
    if (!notification) return;

    markAsRead(notificationId);
    const route = resolveRouteFromNotification(notification);
    if (route) navigate(route);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread · ${notifications.length} total`}
        actions={
          <>
            <Button variant="secondary" onClick={markAllAsRead} disabled={unreadCount === 0}>
              Mark All Read
            </Button>
            <Button variant="ghost" onClick={clearRead} disabled={!hasRead}>
              Clear Read
            </Button>
          </>
        }
      />

      <FilterBar ariaLabel="Notification filters">
        <Input
          aria-label="Search notifications"
          placeholder="Search title, message, source, or related entity"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ width: 'min(420px, 100%)' }}
        />
        <Select
          aria-label="Read filter"
          value={read}
          onChange={(event) => setRead(event.target.value as NotificationReadFilter)}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Unread', value: 'unread' },
            { label: 'Read', value: 'read' },
          ]}
          style={{ width: 150 }}
        />
        <Select
          aria-label="Level filter"
          value={level}
          onChange={(event) => setLevel(event.target.value as 'all' | NotificationLevel)}
          options={[
            { label: 'All levels', value: 'all' },
            { label: 'Info', value: 'info' },
            { label: 'Success', value: 'success' },
            { label: 'Warning', value: 'warning' },
            { label: 'Error', value: 'error' },
          ]}
          style={{ width: 160 }}
        />
        <Select
          aria-label="Source filter"
          value={source}
          onChange={(event) => setSource(event.target.value as 'all' | NotificationSource)}
          options={[
            { label: 'All sources', value: 'all' },
            { label: 'Quotes', value: 'quotes' },
            { label: 'Invoices', value: 'invoices' },
            { label: 'Payments', value: 'payments' },
            { label: 'Templates', value: 'templates' },
            { label: 'PDF', value: 'pdf' },
            { label: 'Email', value: 'email' },
            { label: 'Settings', value: 'settings' },
            { label: 'System', value: 'system' },
          ]}
          style={{ width: 170 }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No notifications match your filters"
          description="Try another filter combination or clear search to view all events."
          action={
            <Button
              variant="primary"
              onClick={() => {
                setRead('all');
                setLevel('all');
                setSource('all');
                setQuery('');
              }}
            >
              Reset Filters
            </Button>
          }
        />
      ) : (
        <ResponsiveList
          headers={['Status', 'Message', 'Source', 'Created', 'Actions']}
          desktopRows={
            <>
              {filtered.map((notification) => {
                const route = resolveRouteFromNotification(notification);
                const readState = isNotificationRead(notification);

                return (
                  <tr key={notification.id} className={readState ? '' : 'dl-row-unread'}>
                    <td>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <Badge variant={levelVariant(notification.level)}>{notification.level}</Badge>
                        <Badge variant={readState ? 'neutral' : 'accent'}>{readState ? 'read' : 'unread'}</Badge>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong>{notification.title}</strong>
                        <span>{notification.message}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <span>{sourceLabel(notification.source)}</span>
                        <span className="dl-muted" style={{ fontSize: 12 }}>
                          {notification.relatedEntityType ?? 'General'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <span>{formatDate(notification.createdAt)}</span>
                        <span className="dl-muted" style={{ fontSize: 12 }}>
                          {formatRelativeDate(notification.createdAt)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="dl-inline-actions">
                        <Button size="sm" onClick={() => openNotification(notification.id)} disabled={!route}>
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            readState ? markAsUnread(notification.id) : markAsRead(notification.id)
                          }
                        >
                          {readState ? 'Mark Unread' : 'Mark Read'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeNotification(notification.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </>
          }
          mobileCards={
            <>
              {filtered.map((notification) => {
                const route = resolveRouteFromNotification(notification);
                const readState = isNotificationRead(notification);
                return (
                  <article key={notification.id} className={`dl-mobile-item ${readState ? '' : 'dl-row-unread'}`}>
                    <div className="dl-mobile-item-header">
                      <strong>{notification.title}</strong>
                      <Badge variant={levelVariant(notification.level)}>{notification.level}</Badge>
                    </div>
                    <p style={{ margin: '0 0 6px' }}>{notification.message}</p>
                    <div className="dl-muted" style={{ fontSize: 12 }}>
                      {sourceLabel(notification.source)} · {formatDate(notification.createdAt)}
                    </div>
                    <div className="dl-inline-actions" style={{ marginTop: 10 }}>
                      <Button size="sm" onClick={() => openNotification(notification.id)} disabled={!route}>
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          readState ? markAsUnread(notification.id) : markAsRead(notification.id)
                        }
                      >
                        {readState ? 'Mark Unread' : 'Mark Read'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeNotification(notification.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </article>
                );
              })}
            </>
          }
        />
      )}
    </>
  );
}
