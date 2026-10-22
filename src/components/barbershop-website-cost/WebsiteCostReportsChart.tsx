import AdminLineChart from '@/components/admin/charts/AdminLineChart';
import { CHART_OVERALL_COLOR } from '@/lib/admin/chartSeriesColors';
import { buildOverallSeries } from '@/lib/admin/reportsChartSeries';
import { getLandingBookingsReportsData } from '@/lib/landing/landingBookingsReportsData';

const reports = getLandingBookingsReportsData('7d');
const points = buildOverallSeries(
  { revenueSeries: reports.revenueSeries, reportBookings: reports.reportBookings },
  'bookings',
);

/** Read-only miniature of the Reports dashboard line chart. Demo fixture only. */
export default function WebsiteCostReportsChart() {
  return (
    <AdminLineChart
      series={[{ key: 'overall', name: 'Bookings', points }]}
      metric="number"
      variant="chart"
      curve="smooth"
      height={168}
      responsive
      showArea
      showCrosshair={false}
      primarySeriesKey="overall"
      hideAxisTitles
      getColor={() => CHART_OVERALL_COLOR}
      getStrokeWidth={() => 2.5}
      ariaLabel="Demo bookings over the last 7 days. Not live shop results."
    />
  );
}
