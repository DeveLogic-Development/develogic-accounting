import { Card } from '@/design-system/primitives/Card';
import { formatDate, formatRelativeDate } from '@/utils/format';

interface DocumentStatusTimelineProps {
  entries: Array<{ id: string; status: string; at: string; note?: string }>;
  title?: string;
}

export function DocumentStatusTimeline({ entries, title = 'Timeline' }: DocumentStatusTimelineProps) {
  const sorted = entries.slice().sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Card title={title} subtitle="Status and action history">
      <div className="dl-timeline">
        {sorted.map((entry) => (
          <div key={entry.id} className="dl-timeline-item">
            <p className="dl-timeline-title">{prettyLabel(entry.status)}</p>
            <p className="dl-timeline-meta">
              {formatDate(entry.at)} ({formatRelativeDate(entry.at)})
              {entry.note ? ` · ${entry.note}` : ''}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function prettyLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}
