import { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
}

export function FilterBar({ children }: FilterBarProps) {
  return <div className="dl-filter-bar">{children}</div>;
}
