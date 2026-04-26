import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  action?: ReactNode;
}

export function Card({ title, subtitle, rightSlot, action, className, children, ...props }: CardProps) {
  const headerAction = rightSlot ?? action;
  return (
    <section className={cn('dl-card', className)} {...props}>
      {title ? (
        <header className="dl-card-header">
          <div>
            <h3 className="dl-card-title">{title}</h3>
            {subtitle ? <p className="dl-card-subtitle">{subtitle}</p> : null}
          </div>
          {headerAction}
        </header>
      ) : null}
      {children}
    </section>
  );
}
