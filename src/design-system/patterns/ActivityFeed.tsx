import { ActivityEvent } from '@/types/domain';
import { formatRelativeDate } from '@/utils/format';

interface ActivityFeedProps {
  events: ActivityEvent[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <div className="dl-timeline">
      {events.map((event) => (
        <div key={event.id} className="dl-timeline-item">
          <p className="dl-timeline-title">
            {event.action} · {event.entity}
          </p>
          <p className="dl-timeline-meta">
            {event.actor} · {formatRelativeDate(event.timestamp)}
            {event.details ? ` · ${event.details}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}
