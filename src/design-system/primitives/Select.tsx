import { SelectHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ label: string; value: string }>;
  helperText?: string;
}

export function Select({ label, options, helperText, className, id, ...props }: SelectProps) {
  if (!label) {
    return (
      <select id={id} className={cn('dl-select', className)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="dl-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className={cn('dl-select', className)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText ? <span className="dl-field-help">{helperText}</span> : null}
    </div>
  );
}
