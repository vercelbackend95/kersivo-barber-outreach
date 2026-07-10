import React from 'react';

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
};

type AdminSegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  size?: 'default' | 'compact';
  trailingSlot?: React.ReactNode;
};

export default function AdminSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
  size = 'default',
  trailingSlot,
}: AdminSegmentedControlProps<T>) {
  return (
    <div
      className={`admin-segmented-control admin-segmented-control--${size} ${className}`.trim()}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`admin-segmented-control__option${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
      {trailingSlot}
    </div>
  );
}
