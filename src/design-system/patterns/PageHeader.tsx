import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="dl-page-header">
      <div>
        <h1 className="dl-page-title">{title}</h1>
        {subtitle ? <p className="dl-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="dl-page-actions">{actions}</div> : null}
    </header>
  );
}
