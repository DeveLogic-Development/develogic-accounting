import { ReactNode } from 'react';

interface TemplateBuilderLayoutProps {
  leftPanel: ReactNode;
  preview: ReactNode;
  rightPanel: ReactNode;
}

export function TemplateBuilderLayout({ leftPanel, preview, rightPanel }: TemplateBuilderLayoutProps) {
  return (
    <div className="dl-builder-layout">
      <div className="dl-card">{leftPanel}</div>
      <div className="dl-card">{preview}</div>
      <div className="dl-card">{rightPanel}</div>
    </div>
  );
}
