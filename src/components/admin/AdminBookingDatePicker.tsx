import { useCallback, useRef, type PointerEvent } from 'react';

type AdminBookingDatePickerProps = {
  value: string;
  label: string;
  onChange: (value: string) => void;
  className?: string;
  showIcon?: boolean;
};

function openNativeDatePicker(input: HTMLInputElement) {
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker();
      return;
    } catch {
      // showPicker can throw if not triggered by a user gesture; fall through.
    }
  }

  input.focus();
  input.click();
}

export default function AdminBookingDatePicker({
  value,
  label,
  onChange,
  className,
  showIcon = true,
}: AdminBookingDatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLabelPointerDown = useCallback((event: PointerEvent<HTMLLabelElement>) => {
    if (event.pointerType === 'keyboard') return;
    event.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    openNativeDatePicker(input);
  }, []);

  const classNames = ['admin-date-picker-label', className].filter(Boolean).join(' ');

  return (
    <label
      className={classNames}
      aria-label={`Select date, currently ${label}`}
      onPointerDown={handleLabelPointerDown}
    >
      <span className="admin-date-picker-text">{label}</span>
      <input
        ref={inputRef}
        type="date"
        className="admin-filter-tab-calendar-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Select date"
      />
      {showIcon ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1H5Z"
            fill="currentColor"
          />
        </svg>
      ) : null}
    </label>
  );
}
