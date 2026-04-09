import { ReactNode } from 'react';

interface StickyActionBarProps {
  children: ReactNode;
}

export function StickyActionBar({ children }: StickyActionBarProps) {
  return <div className="dl-sticky-actions">{children}</div>;
}
