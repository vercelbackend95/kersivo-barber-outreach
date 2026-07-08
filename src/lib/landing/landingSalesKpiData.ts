/**
 * Landing "Inside the System" sales KPI preview data.
 *
 * Demo-only shop sales series anchored to the current date (Europe/London),
 * so the homepage monetization chart always looks current without calling
 * admin APIs or depending on production backend availability.
 */
import { getDemoShopSalesResponse } from '@/lib/admin/demoFixtures/shop';

export type LandingSalesKpiData = ReturnType<typeof getDemoShopSalesResponse>;

export function getLandingSalesKpiData(): LandingSalesKpiData {
  return getDemoShopSalesResponse(new URLSearchParams());
}
