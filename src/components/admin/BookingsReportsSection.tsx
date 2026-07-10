import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SkeletonKPICards } from '../skeleton';
import AdminLineChart from './charts/AdminLineChart';
import AdminAnalyticsStudio from './AdminAnalyticsStudio';
import { useCompactReportsLayout } from './useCompactReportsLayout';
import ReportsRangeToolbar from './ReportsRangeToolbar';
import {
  buildReportsFetchParams,
  getDefaultReportsPreset,
  isCustomRangeComplete,
  type ReportsCustomDateRange,
  type ReportsRangeKey,
} from '@/lib/admin/reportsRange';
import AdminSegmentedControl from './AdminSegmentedControl';
import AdminChartLegend from './AdminChartLegend';
import AdminLeaderboard from './AdminLeaderboard';
import AdminMetricCard from './AdminMetricCard';
import { useBarberSeriesSelection, BARBER_SELECTION_LIMIT_MESSAGE } from './useBarberSeriesSelection';
import {
  buildBarberSeries,
  buildOverallSeries,
  getWinnerBarberId,
  type ReportsChartMetric,
} from '@/lib/admin/reportsChartSeries';
import { CHART_OVERALL_COLOR, getProductSlotColor } from '@/lib/admin/chartSeriesColors';
import { formatDelta } from './reportsFormatting';
import {
  Ban,
  BarChart2,
  Calendar,
  Clock,
  Crown,
  Scissors,
  Tag,
  Ticket,
  User,
  Users,
  X,
} from '../lucide-react';
import type { Barber } from './barbersTypes';

const ADMIN_TIMEZONE = 'Europe/London';

type ReportBookingRow = {
  id: string;
  startAt: string;
  barberId: string;
  barberName: string;
  serviceName: string;
  status: string;
  clientName: string | null;
  clientEmail: string | null;
  computedValueGbp: number | null;
};

type ReportsPayload = {
  range: ReportsRangeKey;
  rangeBoundaries: { from: string; to: string; tz: string };
  previousRangeBoundaries: { from: string; to: string; tz: string };
  bookingsCount: number;
  cancelledRate: number;
  noShowExpiredRate: number;
  revenue: number;
  avgBookingValue: number;
  revenueCount: number;
  usedDemoPricing: boolean;
  breakdown: {
    completed: number;
    cancelledByClient: number;
    cancelledByShop: number;
    noShowExpired: number;
  };
  peakDay: string | null;
  peakHour: string | null;
  bookedMinutes: number;
  availableMinutes: number;
  utilizationPct: number | null;
  revenueSeries: Array<{ label: string; value: number }>;
  trends: {
    bookingsPct: number | null;
    cancelledRatePp: number;
    revenuePct: number | null;
    revenueDelta: number;
    avgBookingValueDelta: number;
    noShowExpiredCountDelta: number;
    noShowExpiredRatePp: number;
    utilizationPp: number | null;
  };
  recentBarbers: Array<{ id: string; name: string; avatarUrl: string | null }>;
  selectedBarber: { id: string; name: string; avatarUrl: string | null } | null;
  previousMetrics: {
    bookingsCount: number;
    cancelledRate: number;
    revenue: number;
    avgBookingValue: number;
    utilizationPct: number | null;
    noShowExpiredCount: number;
    noShowExpiredRate: number;
  };
  mostPopularService: { name: string; count: number } | null;
  busiestBarber: { name: string; count: number } | null;
  reportBookings: ReportBookingRow[];
};

const REPORTS_CHART_METRIC_OPTIONS = [
  { value: 'revenue' as const, label: 'Revenue' },
  { value: 'bookings' as const, label: 'Bookings' },
  { value: 'cancelRate' as const, label: 'Cancel %' },
];

const KERSIVO_LOGO_SRC = '/images/logo-kersivo-dynamic.svg';

function formatPricePence(pricePence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pricePence / 100);
}

function getBarberInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

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
  const [reports, setReports] = useState<ReportsPayload | null>(null);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [reportsRangePreset, setReportsRangePreset] = useState<ReportsRangeKey>(() => {
    if (typeof window === 'undefined') return 'week';
    return getDefaultReportsPreset(window.matchMedia('(max-width: 47.99rem)').matches);
  });
  const [reportsCustomRange, setReportsCustomRange] = useState<ReportsCustomDateRange | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const reportsStudioRef = useRef<HTMLElement>(null);
  const isContainerCompact = useCompactReportsLayout(reportsStudioRef);
  const isCompactLayout = isMobileViewport || isContainerCompact;
  const [chartMetric, setChartMetric] = useState<ReportsChartMetric>('revenue');
  const [barberAddOpen, setBarberAddOpen] = useState(false);
  const [barberAddSearch, setBarberAddSearch] = useState('');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 47.99rem)');
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (!isCompactLayout || reportsRangePreset === 'custom') return;
    if (reportsRangePreset === 'week') {
      setReportsRangePreset('7d');
      return;
    }
    if (reportsRangePreset === '90d') {
      setReportsRangePreset('30d');
    }
  }, [isCompactLayout, reportsRangePreset]);

  const closeBarberAddPanel = useCallback(() => {
    setBarberAddOpen(false);
    setBarberAddSearch('');
  }, []);

  useEffect(() => {
    if (!barberAddOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeBarberAddPanel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [barberAddOpen, closeBarberAddPanel]);

  const handlePresetChange = useCallback((preset: Exclude<ReportsRangeKey, 'custom'>) => {
    setReportsRangePreset(preset);
    setReportsCustomRange(null);
  }, []);

  const handleCustomRangeChange = useCallback((range: ReportsCustomDateRange | null) => {
    if (!range?.from && !range?.to) {
      setReportsCustomRange(null);
      setReportsRangePreset(getDefaultReportsPreset(isCompactLayout));
      return;
    }
    setReportsCustomRange(range);
    if (isCustomRangeComplete(range)) {
      setReportsRangePreset('custom');
    }
  }, [isCompactLayout]);

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

      const data = (await response.json()) as ReportsPayload;
      setReports(data);
    } finally {
      setReportsLoading(false);
    }
  }, [loggedIn, onUnauthorized, reportsCustomRange, reportsRangePreset]);

  useEffect(() => {
    if (!loggedIn || !isActive) return;
    void fetchReports();
  }, [fetchReports, isActive, loggedIn]);

  const allBarbersSorted = useMemo(
    () => [...barbers].sort(
      (a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
        || a.name.localeCompare(b.name, 'en'),
    ),
    [barbers],
  );

  const reportsChartInput = useMemo(
    () => (reports ? { revenueSeries: reports.revenueSeries, reportBookings: reports.reportBookings } : null),
    [reports],
  );

  const validBarberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of reports?.reportBookings ?? []) ids.add(row.barberId);
    return ids;
  }, [reports]);

  const winnerBarberId = useMemo(
    () => (reportsChartInput ? getWinnerBarberId(reportsChartInput, chartMetric) : null),
    [reportsChartInput, chartMetric],
  );

  const barberSelectionKey = `${reportsRangePreset}:${chartMetric}:${reports?.rangeBoundaries.from ?? ''}:${reports?.rangeBoundaries.to ?? ''}`;

  const {
    selectedBarberIds,
    activeSeriesKeys,
    addBarber,
    removeBarber,
    errorMessage: barberSelectionLimitMessage,
  } = useBarberSeriesSelection({
    winnerBarberId,
    validBarberIds,
    selectionKey: barberSelectionKey,
  });

  const barberMetaById = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl: string | null }>();
    for (const barber of barbers) {
      map.set(barber.id, { name: barber.name, avatarUrl: barber.avatarUrl ?? null });
    }
    for (const row of reports?.reportBookings ?? []) {
      if (!map.has(row.barberId)) {
        map.set(row.barberId, { name: row.barberName, avatarUrl: null });
      }
    }
    return map;
  }, [barbers, reports]);

  const winnerBarberName = winnerBarberId ? barberMetaById.get(winnerBarberId)?.name ?? '—' : '—';

  const getReportsSeriesColor = useCallback((seriesKey: string): string => {
    if (seriesKey === 'overall') return CHART_OVERALL_COLOR;
    const slotIndex = selectedBarberIds.indexOf(seriesKey);
    return getProductSlotColor(slotIndex);
  }, [selectedBarberIds]);

  const getReportsSeriesStrokeWidth = useCallback((seriesKey: string): number => {
    if (seriesKey === 'overall') return 2;
    const slotIndex = selectedBarberIds.indexOf(seriesKey);
    return slotIndex === 0 ? 3 : 2;
  }, [selectedBarberIds]);

  const reportsAdminChartSeries = useMemo(() => {
    if (!reportsChartInput) return [];
    return activeSeriesKeys.map((key) => ({
      key,
      name: key === 'overall' ? 'Overall' : barberMetaById.get(key)?.name ?? 'Barber',
      points: key === 'overall'
        ? buildOverallSeries(reportsChartInput, chartMetric)
        : buildBarberSeries(reportsChartInput, key, chartMetric),
    }));
  }, [activeSeriesKeys, barberMetaById, chartMetric, reportsChartInput]);

  const reportsLegendItems = useMemo(() => activeSeriesKeys.map((key) => {
    const isOverall = key === 'overall';
    const meta = barberMetaById.get(key);
    return {
      key,
      label: isOverall ? 'Overall' : meta?.name ?? 'Barber',
      color: getReportsSeriesColor(key),
      isOverall,
      iconSrc: isOverall ? KERSIVO_LOGO_SRC : undefined,
      avatarUrl: !isOverall ? meta?.avatarUrl ?? null : undefined,
      initials: !isOverall && !meta?.avatarUrl ? getBarberInitials(meta?.name ?? 'B') : undefined,
      isWinner: !isOverall && key === winnerBarberId,
    };
  }), [activeSeriesKeys, barberMetaById, getReportsSeriesColor, winnerBarberId]);

  const addableBarbers = useMemo(() => {
    const query = barberAddSearch.trim().toLowerCase();
    return allBarbersSorted.filter((barber) => {
      if (activeSeriesKeys.includes(barber.id)) return false;
      if (!query) return true;
      return barber.name.toLowerCase().includes(query);
    });
  }, [activeSeriesKeys, allBarbersSorted, barberAddSearch]);

  const fmtReportsChartValue = useCallback((value: number) => {
    if (chartMetric === 'revenue') return formatPricePence(value);
    if (chartMetric === 'cancelRate') return `${value.toFixed(1)}%`;
    return `${Math.round(value)}`;
  }, [chartMetric]);

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
  const revenueDelta = formatDelta({
    value: reports?.trends.revenuePct ?? null,
    type: 'percent',
    tone: 'higher_better',
    currentValue: reports?.revenue,
    previousValue: reports?.previousMetrics.revenue,
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
  const reportsHeroValue = chartMetric === 'revenue'
    ? formatCurrencyGbp(reports?.revenue ?? 0)
    : chartMetric === 'bookings'
      ? String(reports?.bookingsCount ?? 0)
      : `${(reports?.cancelledRate ?? 0).toFixed(1)}%`;
  const reportsHeroDelta = chartMetric === 'revenue'
    ? revenueDelta
    : chartMetric === 'bookings'
      ? bookingsDelta
      : cancelledDelta;

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
      <AdminAnalyticsStudio
        ref={reportsStudioRef}
        className="admin-analytics-studio--bookings-reports"
        toolbar={(
          <ReportsRangeToolbar
            preset={reportsRangePreset}
            customRange={reportsCustomRange}
            isMobileViewport={isCompactLayout}
            timezone={ADMIN_TIMEZONE}
            className="admin-reports-studio-toolbar__range"
            onPresetChange={handlePresetChange}
            onCustomRangeChange={handleCustomRangeChange}
          />
        )}
        toolbarSecondary={(
          <AdminSegmentedControl
            options={REPORTS_CHART_METRIC_OPTIONS}
            value={chartMetric}
            onChange={setChartMetric}
            ariaLabel="Chart metric"
            size="compact"
            className="admin-reports-studio-toolbar__metric"
          />
        )}
        headlineValue={reportsLoading && !reports ? '—' : reportsHeroValue}
        headlineDelta={
          reports ? (
            <span className={`admin-kpi-trend ${reportsHeroDelta.className}`}>{reportsHeroDelta.text}</span>
          ) : null
        }
        chart={(
          <div className="admin-sales-chart-wrap">
            <AdminLineChart
              series={reportsAdminChartSeries}
              metric={chartMetric === 'revenue' ? 'currency' : 'number'}
              getColor={getReportsSeriesColor}
              getStrokeWidth={getReportsSeriesStrokeWidth}
              formatValue={fmtReportsChartValue}
              primarySeriesKey="overall"
              showArea={(key) => key === 'overall'}
              responsive
              contentInsetTop={isCompactLayout ? 84 : undefined}
              emptyLabel="No data for this range"
              ariaLabel={`${chartMetric} trend chart`}
            />
          </div>
        )}
        footer={(
          <AdminChartLegend
            items={reportsLegendItems}
            onRemove={removeBarber}
            hint={
              barberSelectionLimitMessage
                ? BARBER_SELECTION_LIMIT_MESSAGE
                : reportsAdminChartSeries.length <= 1
                  ? 'Add a barber to compare performance'
                  : null
            }
            addControl={(
              <div className="admin-chart-legend__add">
                <button
                  type="button"
                  className="admin-chart-legend__add-btn"
                  onClick={() => setBarberAddOpen((open) => !open)}
                  aria-expanded={barberAddOpen}
                >
                  + Add barber
                </button>
                {barberAddOpen ? (
                  <>
                    <button
                      type="button"
                      className="admin-chart-legend__search-backdrop"
                      aria-label="Close add barber panel"
                      onClick={closeBarberAddPanel}
                    />
                    <div
                      className="admin-chart-legend__search-panel"
                      role="dialog"
                      aria-label="Add barber to chart"
                    >
                      <div className="admin-chart-legend__search-panel-head">
                        <input
                          type="search"
                          className="admin-chart-legend__search-input"
                          value={barberAddSearch}
                          onChange={(event) => setBarberAddSearch(event.target.value)}
                          placeholder="Search barbers"
                          aria-label="Search barbers"
                          autoFocus={!isCompactLayout}
                        />
                        <button
                          type="button"
                          className="admin-chart-legend__search-close"
                          onClick={closeBarberAddPanel}
                          aria-label="Close"
                        >
                          <X width={16} height={16} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="admin-chart-legend__search-results" role="list">
                        {addableBarbers.map((barber) => (
                          <button
                            key={`add-barber-${barber.id}`}
                            type="button"
                            className="admin-chart-legend__search-result"
                            role="listitem"
                            onClick={() => {
                              addBarber(barber.id);
                              closeBarberAddPanel();
                            }}
                          >
                            {barber.avatarUrl ? (
                              <img src={barber.avatarUrl} alt="" className="admin-chart-legend__avatar" aria-hidden="true" />
                            ) : (
                              <span className="admin-chart-legend__avatar admin-chart-legend__avatar--initials" aria-hidden="true">
                                {getBarberInitials(barber.name)}
                              </span>
                            )}
                            <span>{barber.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          />
        )}
        statsRow={reports ? (
          <>
            <p className="admin-analytics-studio__stat admin-analytics-studio__stat--leader">
              Leader <strong>{winnerBarberName}</strong>
              {winnerBarberId ? <Crown className="admin-analytics-studio__leader-crown" width={14} height={14} aria-hidden="true" /> : null}
            </p>
            <p className="admin-analytics-studio__stat">
              Bookings <strong>{reports.bookingsCount}</strong>
            </p>
            <p className="admin-analytics-studio__stat">
              Cancel <strong>{reports.cancelledRate.toFixed(1)}%</strong>
            </p>
            <p className="admin-analytics-studio__stat">
              Utilization <strong>{reports.utilizationPct == null ? '—' : `${reports.utilizationPct.toFixed(1)}%`}</strong>
            </p>
            <p className="admin-analytics-studio__stat">
              Peak <strong>{reports.peakDay ?? '—'}{reports.peakHour ? ` · ${reports.peakHour}` : ''}</strong>
            </p>
          </>
        ) : null}
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
