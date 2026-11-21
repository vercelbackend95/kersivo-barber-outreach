/**
 * Landing "Inside the System" bookings-reports preview data.
 * Heritage Grooming, the live demo shop: the same deterministic payload its owner dashboard
 * shows (no Neon). Client-safe.
 */
import { getHeritageBarbersResponse } from '../admin/heritageDemoFixtures/catalog';
import { getHeritageReportsResponse } from '../admin/heritageDemoFixtures/reports';
import type { ReportsRangeKey } from '../admin/reportsRange';
import type { BookingsReportsPayload } from '../../components/admin/BookingsReportsAnalyticsStudio';

export function getLandingBookingsReportsData(
  range: ReportsRangeKey,
  customFrom?: string,
  customTo?: string,
): BookingsReportsPayload {
  return getHeritageReportsResponse(range, customFrom, customTo);
}

export const landingBookingsReportsBarbers = getHeritageBarbersResponse().barbers;
