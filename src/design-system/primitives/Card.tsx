import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}

export function Card({ title, subtitle, rightSlot, className, children, ...props }: CardProps) {
  return (
    <section className={cn('dl-card', className)} {...props}>
      {title ? (
        <header className="dl-card-header">
          <div>
            <h3 className="dl-card-title">{title}</h3>
            {subtitle ? <p className="dl-card-subtitle">{subtitle}</p> : null}
          </div>
          {rightSlot}
        </header>
      ) : null}
      {children}
    </section>
  );
}
