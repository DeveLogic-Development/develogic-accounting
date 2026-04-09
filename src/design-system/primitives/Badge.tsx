import { cn } from '@/utils/cn';

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  return <span className={cn('dl-badge', variant)}>{children}</span>;
}
