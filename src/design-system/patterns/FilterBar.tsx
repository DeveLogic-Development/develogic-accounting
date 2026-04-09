import { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  ariaLabel?: string;
}

export function FilterBar({ children, ariaLabel = 'Filters' }: FilterBarProps) {
  return (
    <section className="dl-filter-bar" aria-label={ariaLabel}>
      {children}
    </section>
  );
}
