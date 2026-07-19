import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BookingsReportsAnalyticsStudio from '@/components/admin/BookingsReportsAnalyticsStudio';
import { useCompactReportsLayout } from '@/components/admin/useCompactReportsLayout';
import type { Barber } from '@/components/admin/barbersTypes';
import {
  getLandingBookingsReportsData,
  landingBookingsReportsBarbers,
} from '@/lib/landing/landingBookingsReportsData';
import {
  readLandingReportsWidgetPrefs,
  writeLandingReportsWidgetPrefs,
} from '@/lib/landing/landingReportsWidgetPrefs';
import { getWinnerBarberId, type ReportsChartMetric } from '@/lib/admin/reportsChartSeries';
import {
  customRangeToYmd,
  getDefaultReportsPreset,
  isCustomRangeComplete,
  type ReportsCustomDateRange,
  type ReportsRangeKey,
} from '@/lib/admin/reportsRange';
import '@/styles/components/booking.css';
import '@/styles/components/landingBookingsReportsWidget.css';

const DEMO_BARBERS: Barber[] = landingBookingsReportsBarbers;

export default function LandingBookingsReportsWidget() {
  const [reportsRangePreset, setReportsRangePreset] = useState<ReportsRangeKey>(() => getDefaultReportsPreset());
  const [reportsCustomRange, setReportsCustomRange] = useState<ReportsCustomDateRange | null>(null);
  const [chartMetric, setChartMetric] = useState<ReportsChartMetric>('revenue');
  const [selectedBarberIds, setSelectedBarberIds] = useState<string[]>([]);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const studioRef = useRef<HTMLElement>(null);
  const isContainerCompact = useCompactReportsLayout(studioRef);
  const isCompactLayout = isMobileViewport || isContainerCompact;
  const hasSeededDefaultBarberRef = useRef(false);

  useEffect(() => {
    const prefs = readLandingReportsWidgetPrefs();
    if (prefs.rangePreset === 'week') {
      setReportsRangePreset('7d');
    } else if (prefs.rangePreset === '90d') {
      setReportsRangePreset('1y');
    } else if (prefs.rangePreset) {
      setReportsRangePreset(prefs.rangePreset);
    } else {
      setReportsRangePreset(getDefaultReportsPreset());
    }
    if (prefs.chartMetric) {
      setChartMetric(prefs.chartMetric);
    }
    if (prefs.selectedBarberIds) {
      hasSeededDefaultBarberRef.current = true;
      setSelectedBarberIds(prefs.selectedBarberIds);
    }
    setPrefsReady(true);
  }, []);

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

  const reports = useMemo(() => {
    const customYmd = customRangeToYmd(reportsCustomRange);
    if (reportsRangePreset === 'custom') {
      if (!customYmd) return getLandingBookingsReportsData('1d');
      return getLandingBookingsReportsData('custom', customYmd.from, customYmd.to);
    }
    return getLandingBookingsReportsData(reportsRangePreset);
  }, [reportsCustomRange, reportsRangePreset]);

  useEffect(() => {
    if (!prefsReady || hasSeededDefaultBarberRef.current || !reports) return;
    const winnerId = getWinnerBarberId(
      { revenueSeries: reports.revenueSeries, reportBookings: reports.reportBookings },
      chartMetric,
    );
    if (winnerId) {
      hasSeededDefaultBarberRef.current = true;
      setSelectedBarberIds([winnerId]);
    }
  }, [chartMetric, prefsReady, reports]);

  useEffect(() => {
    if (!prefsReady) return;
    writeLandingReportsWidgetPrefs({
      rangePreset: reportsRangePreset,
      chartMetric,
      selectedBarberIds,
    });
  }, [chartMetric, prefsReady, reportsRangePreset, selectedBarberIds]);

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

  return (
    <div className="lbrw landing-bookings-reports-widget">
      <BookingsReportsAnalyticsStudio
        ref={studioRef}
        reports={reports}
        barbers={DEMO_BARBERS}
        isCompactLayout={isCompactLayout}
        forceCompactRangeLabels
        reportsRangePreset={reportsRangePreset}
        reportsCustomRange={reportsCustomRange}
        onPresetChange={handlePresetChange}
        onCustomRangeChange={handleCustomRangeChange}
        chartMetric={chartMetric}
        onChartMetricChange={setChartMetric}
        selectedBarberIds={selectedBarberIds}
        onSelectedBarberIdsChange={setSelectedBarberIds}
        showStatsRow
        className="admin-analytics-studio--bookings-reports"
      />
    </div>
  );
}
