import { InputHTMLAttributes } from 'react';

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function Toggle({ label, id, ...props }: ToggleProps) {
  return (
    <label htmlFor={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
      <input id={id} type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
