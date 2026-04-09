import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
}

export function IconButton({ icon, label, className, ...props }: IconButtonProps) {
  return (
    <button className={cn('dl-icon-btn', className)} aria-label={label} title={label} {...props}>
      <span aria-hidden>{icon}</span>
    </button>
  );
}
