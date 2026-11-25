/**
 * Data for the "working day in the dashboard" screens on /barbershop-reports.
 * Every name and figure comes from the fictional Heritage Grooming demo fixtures that its owner
 * dashboard shows (no database). Pure and client-safe; runs in the page frontmatter.
 */
import { getHeritageBarbersResponse } from '@/lib/admin/heritageDemoFixtures/catalog';
import { getHeritageClientDetailResponse } from '@/lib/admin/heritageDemoFixtures/clients';
import { getHeritageBookingsResponse } from '@/lib/admin/heritageDemoFixtures/schedule';
import { getHeritageShopSalesResponse } from '@/lib/admin/heritageDemoFixtures/shop';
import { ADMIN_REPORTS_TIMEZONE } from '@/lib/admin/reportsRange';

const DAY_START_MIN = 9 * 60;
const DAY_SPAN_MIN = 10 * 60;

export type KarTimelineBlock = { left: number; width: number; label: string; state: 'done' | 'next' | 'later' };
export type KarChapterDemo = {
  dayLabel: string;
  bookingsToday: number;
  stillToCome: number;
  timeline: { barber: string; blocks: KarTimelineBlock[] }[];
  client: {
    name: string;
    initials: string;
    reliability: number;
    reliabilityLabel: string;
    visits: number;
    noShows: number;
    totalSpent: string;
    favourite: string;
    tags: string[];
    lastOrder: string | null;
  };
  sales: {
    orders: number;
    aov: string;
    topProduct: string;
    leaderboard: { name: string; units: number; share: number }[];
  };
};

const gbp = (pence: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: pence % 100 ? 2 : 0 }).format(pence / 100);

const londonMinutes = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ADMIN_REPORTS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute');
};

/** Same thresholds as the client profile in the dashboard. */
export function reliabilityLabel(score: number): string {
  if (score >= 75) return 'Excellent';
  if (score >= 55) return 'Good';
  if (score >= 35) return 'Fair';
  return 'Poor';
}

export function buildKarChapterDemo(now = new Date()): KarChapterDemo {
  const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: ADMIN_REPORTS_TIMEZONE }).format(now);
  const { bookings } = getHeritageBookingsResponse(new URLSearchParams({ date: dayKey, mode: 'day' }), now) as {
    bookings: { barberId: string; fullName: string; startAt: string; endAt: string; service: { name: string } }[];
  };
  const barbers = getHeritageBarbersResponse().barbers as { id: string; name: string }[];
  const nowMs = now.getTime();
  const nextStart = bookings
    .map((b) => Date.parse(b.startAt))
    .filter((t) => t > nowMs)
    .sort((a, b) => a - b)[0];

  const timeline = barbers.map((barber) => ({
    barber: barber.name,
    blocks: bookings
      .filter((b) => b.barberId === barber.id)
      .map((b) => {
        const start = londonMinutes(b.startAt) - DAY_START_MIN;
        const end = londonMinutes(b.endAt) - DAY_START_MIN;
        const startMs = Date.parse(b.startAt);
        const state: KarTimelineBlock['state'] = Date.parse(b.endAt) <= nowMs ? 'done' : startMs === nextStart ? 'next' : 'later';
        return {
          left: Math.max(0, (start / DAY_SPAN_MIN) * 100),
          width: Math.max(2, ((end - start) / DAY_SPAN_MIN) * 100),
          label: b.fullName.split(' ')[0] ?? b.fullName,
          state,
        };
      }),
  }));

  const detail = getHeritageClientDetailResponse('hg-client-james-whitfield', now) as {
    client: { fullName: string; tags: string[] };
    stats: { completedCount: number; noShowCount: number; totalSpentPence: number; favouriteService: string | null };
    reliabilityScore: number;
    lastOrder: { items: { nameSnapshot: string }[] } | null;
  };
  const name = detail.client.fullName;

  const sales = getHeritageShopSalesResponse(new URLSearchParams({ range: '7d' }), now) as {
    kpis: { ordersCount: number; avgOrderValuePence: number; bestProduct: { name: string } | null };
    leaderboard: { name: string; units: number }[];
  };
  const top = sales.leaderboard.slice(0, 4);
  const maxUnits = Math.max(1, ...top.map((p) => p.units));

  return {
    dayLabel: new Intl.DateTimeFormat('en-GB', { timeZone: ADMIN_REPORTS_TIMEZONE, weekday: 'short', day: 'numeric', month: 'short' }).format(now),
    bookingsToday: bookings.length,
    stillToCome: bookings.filter((b) => Date.parse(b.startAt) > nowMs).length,
    timeline,
    client: {
      name,
      initials: name
        .split(/\s+/)
        .map((part) => part[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      reliability: detail.reliabilityScore,
      reliabilityLabel: reliabilityLabel(detail.reliabilityScore),
      visits: detail.stats.completedCount,
      noShows: detail.stats.noShowCount,
      totalSpent: gbp(detail.stats.totalSpentPence),
      favourite: detail.stats.favouriteService ?? '—',
      tags: detail.client.tags,
      lastOrder: detail.lastOrder?.items.map((item) => item.nameSnapshot).join(', ') ?? null,
    },
    sales: {
      orders: sales.kpis.ordersCount,
      aov: gbp(sales.kpis.avgOrderValuePence),
      topProduct: sales.kpis.bestProduct?.name ?? '—',
      leaderboard: top.map((p) => ({ name: p.name, units: p.units, share: (p.units / maxUnits) * 100 })),
    },
  };
}
