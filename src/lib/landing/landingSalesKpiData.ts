/**
 * Landing "Inside the System" sales KPI preview data.
 *
 * Demo-only shop sales series anchored to the current date (Europe/London),
 * so the homepage monetization chart always looks current without calling
 * admin APIs or depending on production backend availability.
 */
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

import { DEMO_PRODUCT_IDS } from '@/lib/admin/demoFixtures/ids';

const TZ = 'Europe/London';

export type LandingSalesKpiData = ReturnType<typeof getLandingSalesKpiData>;

function ymdDaysAgoLondon(days: number): string {
  return formatInTimeZone(subDays(new Date(), days), TZ, 'yyyy-MM-dd');
}

export function getLandingSalesKpiData(): {
  range: { from: string; to: string; tz: string };
  kpis: {
    revenuePence: number;
    ordersCount: number;
    avgOrderValuePence: number;
    bestProduct: { productId: string; name: string; revenuePence: number; units: number };
  };
  series: {
    overall: Array<{ date: string; revenuePence: number; units: number }>;
    products: Array<{
      productId: string;
      name: string;
      points: Array<{ date: string; revenuePence: number; units: number }>;
    }>;
  };
  leaderboard: Array<{ productId: string; name: string; units: number; revenuePence: number }>;
} {
  const todayYmd = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
  const fromYmd = ymdDaysAgoLondon(29);
  const dayCount = 7;

  const overall = Array.from({ length: dayCount }, (_, i) => ({
    date: ymdDaysAgoLondon(dayCount - 1 - i),
    revenuePence: 2800 + i * 420,
    units: 2 + (i % 3),
  }));

  return {
    range: { from: fromYmd, to: todayYmd, tz: TZ },
    kpis: {
      revenuePence: 28400,
      ordersCount: 18,
      avgOrderValuePence: 1578,
      bestProduct: {
        productId: DEMO_PRODUCT_IDS.pomade,
        name: 'Matte Pomade',
        revenuePence: 21600,
        units: 12,
      },
    },
    series: {
      overall,
      products: [
        {
          productId: DEMO_PRODUCT_IDS.pomade,
          name: 'Matte Pomade',
          points: overall.map((point) => ({
            ...point,
            revenuePence: Math.round(point.revenuePence * 0.45),
            units: Math.max(1, point.units - 1),
          })),
        },
        {
          productId: DEMO_PRODUCT_IDS.beardOil,
          name: 'Beard Oil',
          points: overall.map((point) => ({
            ...point,
            revenuePence: Math.round(point.revenuePence * 0.35),
            units: 1,
          })),
        },
      ],
    },
    leaderboard: [
      { productId: DEMO_PRODUCT_IDS.pomade, name: 'Matte Pomade', units: 12, revenuePence: 21600 },
      { productId: DEMO_PRODUCT_IDS.beardOil, name: 'Beard Oil', units: 8, revenuePence: 17600 },
      { productId: DEMO_PRODUCT_IDS.clay, name: 'Styling Clay', units: 6, revenuePence: 9600 },
    ],
  };
}
