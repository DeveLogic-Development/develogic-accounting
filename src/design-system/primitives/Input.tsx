import { InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
}

export function Input({ label, helperText, className, id, ...props }: InputProps) {
  if (!label) {
    return <input id={id} className={cn('dl-input', className)} {...props} />;
  }

  return (
    <div className="dl-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={cn('dl-input', className)} {...props} />
      {helperText ? <span className="dl-field-help">{helperText}</span> : null}
    </div>
  );
}
