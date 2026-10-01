import { formatInTimeZone } from 'date-fns-tz';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveBlacklineDemoFixture } from './blacklineDemoFixtures/router';
import {
  BLACKLINE_HERO_SHOWCASE_DAY,
  BLACKLINE_HERO_SHOWCASE_NOW_ISO,
  blacklineHeroShowcaseNow,
  isHeroShowcaseUrl,
} from './heroShowcase';

type Row = {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  barber: { name: string };
  service: { name: string };
};

/** Morning, evening, another weekday, another month/year, and a Sunday in another zone. */
const SYSTEM_TIMES = [
  '2026-03-10T07:05:00.000Z',
  '2026-06-18T20:45:00.000Z',
  '2026-10-09T13:30:00.000Z',
  '2027-01-24T11:00:00.000Z',
  '2025-12-25T03:15:00.000Z',
];

async function showcaseSnapshot() {
  const now = blacklineHeroShowcaseNow();
  const params = new URLSearchParams({ date: BLACKLINE_HERO_SHOWCASE_DAY, mode: 'day' });
  const result = await resolveBlacklineDemoFixture('/api/demo/admin/bookings', params, 'GET', undefined, { now });
  const rows = (result?.body as { bookings: Row[] }).bookings;
  const upcoming = rows
    .filter((row) => row.status === 'BOOKED' && new Date(row.endAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const reports = await resolveBlacklineDemoFixture('/api/demo/admin/reports', new URLSearchParams({ range: '7d' }), 'GET', undefined, { now });
  const clients = await resolveBlacklineDemoFixture('/api/demo/admin/clients', new URLSearchParams(), 'GET', undefined, { now });
  const sales = await resolveBlacklineDemoFixture('/api/demo/admin/shop/sales', new URLSearchParams(), 'GET', undefined, { now });
  return {
    rows,
    upcoming,
    json: JSON.stringify({ rows, reports: reports?.body, clients: clients?.body, sales: sales?.body }),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('BLACKLINE hero showcase clock', () => {
  it('is a busy weekday afternoon in London', () => {
    const now = blacklineHeroShowcaseNow();
    expect(now.toISOString()).toBe(BLACKLINE_HERO_SHOWCASE_NOW_ISO);
    expect(formatInTimeZone(now, 'Europe/London', 'yyyy-MM-dd')).toBe(BLACKLINE_HERO_SHOWCASE_DAY);
    expect(formatInTimeZone(now, 'Europe/London', 'EEEE HH:mm')).toBe('Tuesday 15:25');
  });

  it('shows 21 fixture bookings with Noah Reid · Skin Fade next, without a synthetic live row', async () => {
    const { rows, upcoming } = await showcaseSnapshot();
    expect(rows).toHaveLength(21);
    expect(rows.some((row) => row.id.endsWith('-live'))).toBe(false);
    expect(upcoming[0]).toMatchObject({ barber: { name: 'Noah Reid' }, service: { name: 'Skin Fade' } });
    expect(formatInTimeZone(new Date(upcoming[0]!.startAt), 'Europe/London', 'HH:mm')).toBe('15:15');
    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ COMPLETED: 10, CANCELLED_BY_CLIENT: 1, NO_SHOW: 1, BOOKED: 9 });
  });

  it('produces identical bookings, reports, clients and sales whatever the real system time is', async () => {
    const snapshots: string[] = [];
    for (const systemTime of SYSTEM_TIMES) {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(systemTime));
      snapshots.push((await showcaseSnapshot()).json);
      vi.useRealTimers();
    }
    for (const snapshot of snapshots) expect(snapshot).toBe(snapshots[0]);
  });

  it('leaves the normal demo on the real clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-18T09:40:00.000Z'));
    const result = await resolveBlacklineDemoFixture('/api/demo/admin/bookings', new URLSearchParams({ mode: 'day' }));
    const rows = (result?.body as { bookings: Row[] }).bookings;
    expect(rows.length).toBeGreaterThan(0);
    expect(formatInTimeZone(new Date(rows[0]!.startAt), 'Europe/London', 'yyyy-MM-dd')).toBe('2026-06-18');
  });

  it('recognises only the BLACKLINE hero embed URL', () => {
    expect(isHeroShowcaseUrl(new URL('https://x.test/demo/admin?embed=hero&section=bookings_dashboard'))).toBe(true);
    expect(isHeroShowcaseUrl(new URL('https://x.test/demo/admin?section=bookings_dashboard'))).toBe(false);
    expect(isHeroShowcaseUrl(new URL('https://x.test/admin-demo?embed=hero'))).toBe(false);
    expect(isHeroShowcaseUrl(new URL('https://x.test/admin?embed=hero'))).toBe(false);
  });
});
