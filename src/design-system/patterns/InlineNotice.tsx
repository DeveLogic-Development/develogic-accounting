import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type InlineNoticeTone = 'info' | 'success' | 'warning' | 'error';

interface InlineNoticeProps {
  tone?: InlineNoticeTone;
  children: ReactNode;
  className?: string;
  role?: 'status' | 'alert';
}

export function InlineNotice({
  tone = 'info',
  children,
  className,
  role = 'status',
}: InlineNoticeProps) {
  return (
    <div className={cn('dl-feedback', tone, className)} role={role} aria-live="polite">
      {children}
    </div>
  );
}
