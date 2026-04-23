import { CSSProperties, SelectHTMLAttributes, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ label: string; value: string }>;
  helperText?: string;
}

export function Select({
  label,
  options,
  helperText,
  className,
  id,
  value,
  defaultValue,
  onChange,
  disabled,
  style,
  ...props
}: SelectProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const [internalValue, setInternalValue] = useState(() =>
    String(defaultValue ?? value ?? options[0]?.value ?? ''),
  );
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const isControlled = value !== undefined;
  const selectedValue = String(isControlled ? value ?? '' : internalValue);
  const selectedLabel =
    options.find((option) => option.value === selectedValue)?.label ?? options[0]?.label ?? '';

  useEffect(() => {
    if (!isControlled) return;
    setInternalValue(String(value ?? ''));
  }, [isControlled, value]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobileViewport(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  const handleNativeChange: SelectHTMLAttributes<HTMLSelectElement>['onChange'] = (event) => {
    if (!isControlled) {
      setInternalValue(event.target.value);
    }
    onChange?.(event);
  };

  const updatePopoverPosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 10;
    const width = Math.max(240, Math.min(window.innerWidth - viewportPadding * 2, triggerRect.width));
    const menuHeight = Math.min(360, Math.max(72, options.length * 48 + 12));
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const shouldOpenUp = spaceBelow < menuHeight + viewportPadding;

    const top = shouldOpenUp
      ? Math.max(viewportPadding, triggerRect.top - menuHeight - 8)
      : Math.min(window.innerHeight - menuHeight - viewportPadding, triggerRect.bottom + 8);
    const left = Math.max(
      viewportPadding,
      Math.min(window.innerWidth - width - viewportPadding, triggerRect.left),
    );

    setPopoverStyle({
      position: 'fixed',
      top,
      left,
      width,
      maxHeight: menuHeight,
      zIndex: 220,
    });
  };

  useEffect(() => {
    if (!open) return;

    updatePopoverPosition();
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleViewportChange = () => updatePopoverPosition();

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, options.length]);

  const selectValue = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    if (selectRef.current) {
      if (selectRef.current.value !== nextValue) {
        selectRef.current.value = nextValue;
      }
      selectRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setOpen(false);
  };

  const selectControl = !isMobileViewport ? (
    <select
      ref={selectRef}
      id={id}
      className={cn('dl-select', className)}
      value={selectedValue}
      onChange={handleNativeChange}
      disabled={disabled}
      style={style}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ) : (
    <div className={cn('dl-select-mobile-wrap', className)} style={style}>
      <select
        ref={selectRef}
        id={id}
        className="dl-select dl-select-mobile-native"
        value={selectedValue}
        onChange={handleNativeChange}
        disabled={disabled}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        ref={triggerRef}
        type="button"
        className="dl-select dl-select-mobile-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={props['aria-label']}
        disabled={disabled}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span>{selectedLabel}</span>
        <span aria-hidden>⌄</span>
      </button>
      {open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dl-select-mobile-popover"
              role="listbox"
              aria-label={props['aria-label']}
              style={popoverStyle}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="dl-select-mobile-option"
                  role="option"
                  aria-selected={option.value === selectedValue}
                  onClick={() => selectValue(option.value)}
                >
                  <span aria-hidden>{option.value === selectedValue ? '✓' : ''}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );

  if (!label) {
    return selectControl;
  }

  return (
    <div className="dl-field">
      <label htmlFor={id}>{label}</label>
      {selectControl}
      {helperText ? <span className="dl-field-help">{helperText}</span> : null}
    </div>
  );
}
