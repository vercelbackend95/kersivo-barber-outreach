/**
 * Landing "Inside the System" bookings-reports preview data.
 * Delegates to the shared admin-demo generator (same deterministic payload, no Neon).
 */
import { demoBarbersResponse } from '../admin/demoFixtures/barbers';
import { getDemoReportsResponse } from '../admin/demoFixtures/reports';
import type { ReportsRangeKey } from '../admin/reportsRange';
import type { BookingsReportsPayload } from '../../components/admin/BookingsReportsAnalyticsStudio';

export function getLandingBookingsReportsData(
  range: ReportsRangeKey,
  customFrom?: string,
  customTo?: string,
): BookingsReportsPayload {
  return getDemoReportsResponse(range, customFrom, customTo);
}

export const landingBookingsReportsBarbers = demoBarbersResponse.barbers;
