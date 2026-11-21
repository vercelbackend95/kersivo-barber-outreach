import { formatInTimeZone } from 'date-fns-tz';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveHeritageDemoFixture } from './heritageDemoFixtures/router';
import {
  HERO_SHOWCASE_DAY,
  HERO_SHOWCASE_NOW_ISO,
  heroShowcaseNow,
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
  const now = heroShowcaseNow();
  const params = new URLSearchParams({ date: HERO_SHOWCASE_DAY, mode: 'day' });
  const result = await resolveHeritageDemoFixture('/api/demo/heritage/admin/bookings', params, 'GET', undefined, { now });
  const rows = (result?.body as { bookings: Row[] }).bookings;
  const upcoming = rows
    .filter((row) => row.status === 'BOOKED' && new Date(row.endAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const reports = await resolveHeritageDemoFixture('/api/demo/heritage/admin/reports', new URLSearchParams({ range: '7d' }), 'GET', undefined, { now });
  const clients = await resolveHeritageDemoFixture('/api/demo/heritage/admin/clients', new URLSearchParams(), 'GET', undefined, { now });
  const sales = await resolveHeritageDemoFixture('/api/demo/heritage/admin/shop/sales', new URLSearchParams(), 'GET', undefined, { now });
  return {
    rows,
    upcoming,
    json: JSON.stringify({ rows, reports: reports?.body, clients: clients?.body, sales: sales?.body }),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Heritage Grooming hero showcase clock', () => {
  it('is a busy weekday afternoon in London', () => {
    const now = heroShowcaseNow();
    expect(now.toISOString()).toBe(HERO_SHOWCASE_NOW_ISO);
    expect(formatInTimeZone(now, 'Europe/London', 'yyyy-MM-dd')).toBe(HERO_SHOWCASE_DAY);
    expect(formatInTimeZone(now, 'Europe/London', 'EEEE HH:mm')).toBe('Thursday 15:25');
  });

  it('shows 47 fixture bookings with Rafi Mendes · The Heritage next, without a synthetic live row', async () => {
    const { rows, upcoming } = await showcaseSnapshot();
    expect(rows).toHaveLength(47);
    expect(rows.some((row) => row.id.endsWith('-live'))).toBe(false);
    expect(upcoming[0]).toMatchObject({ barber: { name: 'Rafi Mendes' }, service: { name: 'The Heritage' } });
    expect(formatInTimeZone(new Date(upcoming[0]!.startAt), 'Europe/London', 'HH:mm')).toBe('14:30');
    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ COMPLETED: 30, CANCELLED_BY_CLIENT: 1, NO_SHOW: 1, BOOKED: 15 });
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
    const result = await resolveHeritageDemoFixture('/api/demo/heritage/admin/bookings', new URLSearchParams({ mode: 'day' }));
    const rows = (result?.body as { bookings: Row[] }).bookings;
    expect(rows.length).toBeGreaterThan(0);
    expect(formatInTimeZone(new Date(rows[0]!.startAt), 'Europe/London', 'yyyy-MM-dd')).toBe('2026-06-18');
  });

  it('recognises only the Heritage Grooming hero embed URL', () => {
    expect(isHeroShowcaseUrl(new URL('https://x.test/demo/heritage-grooming/admin?embed=hero&section=bookings_dashboard'))).toBe(true);
    expect(isHeroShowcaseUrl(new URL('https://x.test/demo/heritage-grooming/admin?section=bookings_dashboard'))).toBe(false);
    expect(isHeroShowcaseUrl(new URL('https://x.test/demo/admin?embed=hero&section=bookings_dashboard'))).toBe(false);
    expect(isHeroShowcaseUrl(new URL('https://x.test/admin-demo?embed=hero'))).toBe(false);
    expect(isHeroShowcaseUrl(new URL('https://x.test/admin?embed=hero'))).toBe(false);
  });
});
