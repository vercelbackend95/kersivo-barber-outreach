import React, { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import AdminLineChart from './charts/AdminLineChart';
import AdminAnalyticsStudio from './AdminAnalyticsStudio';
import ReportsRangeToolbar from './ReportsRangeToolbar';
import type { ReportsCustomDateRange, ReportsRangeKey } from '@/lib/admin/reportsRange';
import AdminSegmentedControl from './AdminSegmentedControl';
import AdminChartLegend from './AdminChartLegend';
import { useBarberSeriesSelection, BARBER_SELECTION_LIMIT_MESSAGE } from './useBarberSeriesSelection';
import {
  buildBarberSeries,
  buildOverallSeries,
  getWinnerBarberId,
  type ReportsChartMetric,
} from '@/lib/admin/reportsChartSeries';
import { CHART_OVERALL_COLOR, getProductSlotColor } from '@/lib/admin/chartSeriesColors';
import { formatDelta } from './reportsFormatting';
import { Crown, X } from '../lucide-react';
import type { Barber } from './barbersTypes';

const ADMIN_TIMEZONE = 'Europe/London';

export type ReportBookingRow = {
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

export type BookingsReportsPayload = {
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

type BookingsReportsAnalyticsStudioProps = {
  reports: BookingsReportsPayload | null;
  reportsLoading?: boolean;
  barbers: Barber[];
  isCompactLayout: boolean;
  reportsRangePreset: ReportsRangeKey;
  reportsCustomRange: ReportsCustomDateRange | null;
  onPresetChange: (preset: Exclude<ReportsRangeKey, 'custom'>) => void;
  onCustomRangeChange: (range: ReportsCustomDateRange | null) => void;
  showStatsRow?: boolean;
  className?: string;
  chartMetric?: ReportsChartMetric;
  onChartMetricChange?: (metric: ReportsChartMetric) => void;
  selectedBarberIds?: string[];
  onSelectedBarberIdsChange?: (ids: string[]) => void;
};

const BookingsReportsAnalyticsStudio = forwardRef<HTMLElement, BookingsReportsAnalyticsStudioProps>(
  function BookingsReportsAnalyticsStudio(
    {
      reports,
      reportsLoading = false,
      barbers,
      isCompactLayout,
      reportsRangePreset,
      reportsCustomRange,
      onPresetChange,
      onCustomRangeChange,
      showStatsRow = true,
      className = 'admin-analytics-studio--bookings-reports',
      chartMetric: controlledChartMetric,
      onChartMetricChange,
      selectedBarberIds: controlledSelectedBarberIds,
      onSelectedBarberIdsChange,
    },
    ref,
  ) {
    const [internalChartMetric, setInternalChartMetric] = useState<ReportsChartMetric>('revenue');
    const chartMetric = controlledChartMetric ?? internalChartMetric;
    const setChartMetric = onChartMetricChange ?? setInternalChartMetric;
    const [barberAddOpen, setBarberAddOpen] = useState(false);
    const [barberAddSearch, setBarberAddSearch] = useState('');

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
    controlledSelectedBarberIds,
    onSelectedBarberIdsChange,
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
    const cancelledDelta = formatDelta({
      value: reports?.trends.cancelledRatePp ?? null,
      type: 'pp',
      tone: 'lower_better',
      currentValue: reports?.cancelledRate,
      previousValue: reports?.previousMetrics.cancelledRate,
    });

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

    return (
      <AdminAnalyticsStudio
        ref={ref}
        className={className}
        toolbar={(
          <ReportsRangeToolbar
            preset={reportsRangePreset}
            customRange={reportsCustomRange}
            isMobileViewport={isCompactLayout}
            timezone={ADMIN_TIMEZONE}
            className="admin-reports-studio-toolbar__range"
            onPresetChange={onPresetChange}
            onCustomRangeChange={onCustomRangeChange}
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
        statsRow={showStatsRow && reports ? (
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
    );
  },
);

export default BookingsReportsAnalyticsStudio;
