import React, { useMemo } from 'react';
import AdminSegmentedControl, { type SegmentedControlOption } from './AdminSegmentedControl';
import HistoryDateRangePicker from './HistoryDateRangePicker';

export type SegmentedDateRange = {
  from?: Date;
  to?: Date;
};

type AdminSegmentedRangeControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  customRange: SegmentedDateRange | null;
  isMobileViewport: boolean;
  timezone: string;
  onCustomRangeChange: (range: SegmentedDateRange | null) => void;
  ariaLabel: string;
  className?: string;
  size?: 'default' | 'compact';
};

export default function AdminSegmentedRangeControl<T extends string>({
  options,
  value,
  onChange,
  customRange,
  isMobileViewport,
  timezone,
  onCustomRangeChange,
  ariaLabel,
  className = '',
  size = 'default',
}: AdminSegmentedRangeControlProps<T>) {
  const segmentedValue = useMemo(() => {
    if (customRange?.from && customRange?.to) return '' as T;
    return value;
  }, [customRange, value]);

  return (
    <AdminSegmentedControl
      options={options}
      value={segmentedValue}
      onChange={onChange}
      ariaLabel={ariaLabel}
      className={className}
      size={size}
      trailingSlot={(
        <HistoryDateRangePicker
          dateRange={customRange}
          isMobileViewport={isMobileViewport}
          timezone={timezone}
          variant="segment"
          onChangeRange={(range) => {
            if (!range?.from && !range?.to) {
              onCustomRangeChange(null);
              return;
            }
            onCustomRangeChange(range);
          }}
          onClear={() => onCustomRangeChange(null)}
        />
      )}
    />
  );
}
