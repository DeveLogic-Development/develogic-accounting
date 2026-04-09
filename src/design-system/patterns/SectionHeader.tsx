import { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function SectionHeader({ title, actions }: SectionHeaderProps) {
  return (
    <div className="dl-section-header">
      <h3>{title}</h3>
      {actions}
    </div>
  );
}
