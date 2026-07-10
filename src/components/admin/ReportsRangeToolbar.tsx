import React from 'react';
import AdminSegmentedRangeControl from './AdminSegmentedRangeControl';
import {
  ADMIN_REPORTS_TIMEZONE,
  DESKTOP_REPORTS_RANGE_OPTIONS,
  MOBILE_REPORTS_RANGE_OPTIONS,
  type ReportsCustomDateRange,
  type ReportsPresetKey,
  type ReportsRangeKey,
} from '@/lib/admin/reportsRange';

type ReportsRangeToolbarProps = {
  preset: ReportsRangeKey;
  customRange: ReportsCustomDateRange | null;
  isMobileViewport: boolean;
  timezone?: string;
  className?: string;
  onPresetChange: (preset: ReportsPresetKey) => void;
  onCustomRangeChange: (range: ReportsCustomDateRange | null) => void;
};

export default function ReportsRangeToolbar({
  preset,
  customRange,
  isMobileViewport,
  timezone = ADMIN_REPORTS_TIMEZONE,
  className = '',
  onPresetChange,
  onCustomRangeChange,
}: ReportsRangeToolbarProps) {
  const options = isMobileViewport ? MOBILE_REPORTS_RANGE_OPTIONS : DESKTOP_REPORTS_RANGE_OPTIONS;

  const segmentedValue = preset === 'custom' ? ('' as ReportsPresetKey) : preset;

  return (
    <AdminSegmentedRangeControl
      options={options}
      value={segmentedValue}
      onChange={onPresetChange}
      customRange={customRange}
      isMobileViewport={isMobileViewport}
      timezone={timezone}
      onCustomRangeChange={onCustomRangeChange}
      ariaLabel="Report range"
      className={className}
    />
  );
}
