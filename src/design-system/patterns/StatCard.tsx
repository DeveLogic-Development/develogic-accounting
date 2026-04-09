import { Card } from '@/design-system/primitives/Card';

interface StatCardProps {
  label: string;
  value: string;
  meta?: string;
}

export function StatCard({ label, value, meta }: StatCardProps) {
  return (
    <Card title={label}>
      <p className="dl-stat-value">{value}</p>
      {meta ? <p className="dl-stat-meta">{meta}</p> : null}
    </Card>
  );
}
