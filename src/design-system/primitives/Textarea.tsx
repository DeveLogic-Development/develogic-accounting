import { TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
}

export function Textarea({ label, helperText, className, id, ...props }: TextareaProps) {
  if (!label) {
    return <textarea id={id} className={cn('dl-textarea', className)} {...props} />;
  }

  return (
    <div className="dl-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className={cn('dl-textarea', className)} {...props} />
      {helperText ? <span className="dl-field-help">{helperText}</span> : null}
    </div>
  );
}
