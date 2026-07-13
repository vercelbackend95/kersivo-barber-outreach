import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SkeletonKPICards } from '../skeleton';
import BookingsReportsAnalyticsStudio, { type BookingsReportsPayload } from './BookingsReportsAnalyticsStudio';
import { useCompactReportsLayout } from './useCompactReportsLayout';
import {
  buildReportsFetchParams,
  getDefaultReportsPreset,
  isCustomRangeComplete,
  type ReportsCustomDateRange,
  type ReportsRangeKey,
} from '@/lib/admin/reportsRange';
import AdminLeaderboard from './AdminLeaderboard';
import AdminMetricCard from './AdminMetricCard';
import { formatDelta } from './reportsFormatting';
import {
  Ban,
  BarChart2,
  Calendar,
  Clock,
  Scissors,
  Tag,
  Ticket,
  User,
  Users,
} from '../lucide-react';
import type { Barber } from './barbersTypes';

function formatCurrencyGbp(value: number): string {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: Math.abs(rounded) >= 100 ? 0 : 2,
    maximumFractionDigits: Math.abs(rounded) >= 100 ? 0 : 2,
  }).format(rounded);
}

function formatDurationMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

type BookingsReportsSectionProps = {
  isActive: boolean;
  loggedIn: boolean;
  barbers: Barber[];
  onUnauthorized: () => void;
  onOpenBarber?: (barberId: string, meta: { name: string }) => void;
};

export default function BookingsReportsSection({
  isActive,
  loggedIn,
  barbers,
  onUnauthorized,
  onOpenBarber,
}: BookingsReportsSectionProps) {
  const [reports, setReports] = useState<BookingsReportsPayload | null>(null);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [reportsRangePreset, setReportsRangePreset] = useState<ReportsRangeKey>(() => getDefaultReportsPreset());
  const [reportsCustomRange, setReportsCustomRange] = useState<ReportsCustomDateRange | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const reportsStudioRef = useRef<HTMLElement>(null);
  const isContainerCompact = useCompactReportsLayout(reportsStudioRef);
  const isCompactLayout = isMobileViewport || isContainerCompact;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 47.99rem)');
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (reportsRangePreset === 'custom') return;
    if (reportsRangePreset === 'week') {
      setReportsRangePreset('7d');
      return;
    }
    if (reportsRangePreset === '90d') {
      setReportsRangePreset('1y');
    }
  }, [reportsRangePreset]);

  const handlePresetChange = useCallback((preset: Exclude<ReportsRangeKey, 'custom'>) => {
    setReportsRangePreset(preset);
    setReportsCustomRange(null);
  }, []);

  const handleCustomRangeChange = useCallback((range: ReportsCustomDateRange | null) => {
    if (!range?.from && !range?.to) {
      setReportsCustomRange(null);
      setReportsRangePreset(getDefaultReportsPreset());
      return;
    }
    setReportsCustomRange(range);
    if (isCustomRangeComplete(range)) {
      setReportsRangePreset('custom');
    }
  }, []);

  const fetchReports = useCallback(async () => {
    if (!loggedIn) return;

    const params = buildReportsFetchParams(reportsRangePreset, reportsCustomRange);
    if (!params) {
      setReportsError('Select a complete custom date range to load reports.');
      setReportsLoading(false);
      return;
    }

    setReportsError('');
    setReportsLoading(true);
    try {
      const response = await fetch(`/api/admin/reports?${params.toString()}`, { credentials: 'include' });

      if (response.status === 401) {
        onUnauthorized();
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setReportsError(payload?.error ?? 'Could not load reports right now.');
        return;
      }

      const data = (await response.json()) as BookingsReportsPayload;
      setReports(data);
    } finally {
      setReportsLoading(false);
    }
  }, [loggedIn, onUnauthorized, reportsCustomRange, reportsRangePreset]);

  useEffect(() => {
    if (!loggedIn || !isActive) return;
    void fetchReports();
  }, [fetchReports, isActive, loggedIn]);

  const reportsBreakdownTotal = useMemo(() => {
    if (!reports) return 0;
    return reports.breakdown.completed + reports.breakdown.cancelledByClient + reports.breakdown.cancelledByShop + reports.breakdown.noShowExpired;
  }, [reports]);

  const reportsBookedVsAvailableLabel = useMemo(() => {
    if (!reports) return '—';
    if (reports.availableMinutes <= 0) return 'No working hours in range';
    return `Booked ${formatDurationMinutes(reports.bookedMinutes)} / Available ${formatDurationMinutes(reports.availableMinutes)}`;
  }, [reports]);

  const bookingsDelta = formatDelta({
    value: reports?.trends.bookingsPct ?? null,
    type: 'percent',
    tone: 'higher_better',
    currentValue: reports?.bookingsCount,
    previousValue: reports?.previousMetrics.bookingsCount,
  });
  const utilizationDelta = formatDelta({
    value: reports?.trends.utilizationPp ?? null,
    type: 'pp',
    tone: 'higher_better',
    currentValue: reports?.utilizationPct,
    previousValue: reports?.previousMetrics.utilizationPct,
  });
  const cancelledDelta = formatDelta({
    value: reports?.trends.cancelledRatePp ?? null,
    type: 'pp',
    tone: 'lower_better',
    currentValue: reports?.cancelledRate,
    previousValue: reports?.previousMetrics.cancelledRate,
  });
  const avgBookingValueDelta = formatDelta({
    value: reports?.trends.avgBookingValueDelta ?? null,
    type: 'currency',
    tone: 'higher_better',
    currentValue: reports?.avgBookingValue,
    previousValue: reports?.previousMetrics.avgBookingValue,
  });
  const noShowExpiredDelta = formatDelta({
    value: reports?.trends.noShowExpiredRatePp ?? null,
    type: 'pp',
    tone: 'lower_better',
    currentValue: reports?.noShowExpiredRate,
    previousValue: reports?.previousMetrics.noShowExpiredRate,
  });

  const reportsCancelledCount = (reports?.breakdown.cancelledByClient ?? 0) + (reports?.breakdown.cancelledByShop ?? 0);
  const isSmallSample = (reports?.bookingsCount ?? 0) > 0 && (reports?.bookingsCount ?? 0) < 10;

  const reportsLeaderboardRows = useMemo(() => {
    if (!reports) return [];
    const byBarber = new Map<string, { name: string; revenue: number; bookings: number }>();
    for (const row of reports.reportBookings ?? []) {
      const entry = byBarber.get(row.barberId) ?? { name: row.barberName, revenue: 0, bookings: 0 };
      entry.bookings += 1;
      entry.revenue += row.computedValueGbp ?? 0;
      byBarber.set(row.barberId, entry);
    }
    return Array.from(byBarber.entries())
      .map(([id, entry]) => ({
        id,
        name: entry.name,
        value: entry.revenue > 0 ? entry.revenue : entry.bookings,
        valueLabel: entry.revenue > 0 ? formatCurrencyGbp(entry.revenue) : `${entry.bookings}`,
        note: `${entry.bookings} bookings`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [reports]);

  return (
    <>
      <BookingsReportsAnalyticsStudio
        ref={reportsStudioRef}
        reports={reports}
        reportsLoading={reportsLoading}
        barbers={barbers}
        isCompactLayout={isCompactLayout}
        reportsRangePreset={reportsRangePreset}
        reportsCustomRange={reportsCustomRange}
        onPresetChange={handlePresetChange}
        onCustomRangeChange={handleCustomRangeChange}
      />

      <div className="admin-reports-body" aria-live="polite">
      {reportsError && <p className="admin-inline-error">{reportsError}</p>}
      {reportsLoading && reports === null ? (
        <div className="admin-reports-metrics" aria-busy="true" aria-hidden="true">
          <SkeletonKPICards count={9} variant="metric" />
        </div>
      ) : null}
      <div className={`admin-reports-metrics${reportsLoading && reports === null ? ' admin-reports-metrics--hidden' : ''}`}>
        <AdminMetricCard
          label="Bookings"
          icon={Ticket}
          value={reports?.bookingsCount ?? 0}
          delta={bookingsDelta}
          note={isSmallSample ? 'Small sample — trends may be unreliable' : undefined}
        />

        <AdminMetricCard
          label="Cancelled rate"
          icon={Ban}
          value={`${(reports?.cancelledRate ?? 0).toFixed(1)}%`}
          delta={cancelledDelta}
          note={`${reportsCancelledCount} of ${reports?.bookingsCount ?? 0} bookings`}
          breakdown={(
            <div className="admin-reports-breakdown" aria-label="Completion breakdown">
              <div className="admin-reports-breakdown-bar" aria-hidden="true">
                <span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.completed ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-completed" />
                <span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.cancelledByClient ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-cancel-client" />
                <span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.cancelledByShop ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-cancel-shop" />
                <span style={{ width: `${reportsBreakdownTotal ? ((reports?.breakdown.noShowExpired ?? 0) / reportsBreakdownTotal) * 100 : 0}%` }} className="is-no-show" />
              </div>
              <p className="admin-reports-breakdown-legend">
                <span><i className="is-completed" /> Completed</span>
                <span><i className="is-cancel-client" /> Client</span>
                <span><i className="is-cancel-shop" /> Shop</span>
                <span><i className="is-no-show" /> No-show</span>
              </p>
            </div>
          )}
        />

        <AdminMetricCard
          label="Utilization"
          icon={BarChart2}
          value={reports?.utilizationPct == null ? '—' : `${reports.utilizationPct.toFixed(1)}%`}
          delta={utilizationDelta}
          note={reportsBookedVsAvailableLabel}
        />

        <AdminMetricCard
          label="Avg booking value"
          icon={Tag}
          value={formatCurrencyGbp(reports?.avgBookingValue ?? 0)}
          delta={avgBookingValueDelta}
        />

        <AdminMetricCard
          label="No-show"
          icon={Users}
          value={`${(reports?.noShowExpiredRate ?? 0).toFixed(1)}%`}
          delta={noShowExpiredDelta}
        />

        <AdminMetricCard
          label="Peak day"
          icon={Calendar}
          value={reports?.peakDay ?? '—'}
          valueVariant="text"
        />

        <AdminMetricCard
          label="Peak hour"
          icon={Clock}
          value={reports?.peakHour ?? '—'}
          valueVariant="text"
        />

        <AdminMetricCard
          label="Most popular service"
          icon={Scissors}
          value={reports?.mostPopularService ? `${reports.mostPopularService.name} (${reports.mostPopularService.count})` : 'No confirmed bookings'}
          valueVariant="text"
        />

        <AdminMetricCard
          label="Busiest barber"
          icon={User}
          value={reports?.busiestBarber ? `${reports.busiestBarber.name} (${reports.busiestBarber.count})` : 'No confirmed bookings'}
          valueVariant="text"
        />
      </div>
      <AdminLeaderboard
        title="Barber leaderboard"
        emptyLabel="No bookings in this range."
        rows={reportsLeaderboardRows}
        onOpenBarber={onOpenBarber}
      />
      </div>
    </>
  );
}
