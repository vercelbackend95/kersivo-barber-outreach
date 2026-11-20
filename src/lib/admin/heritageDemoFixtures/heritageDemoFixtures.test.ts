import { describe, expect, it } from 'vitest';
import { londonNowMinutes } from '@/lib/admin/blacklineDemoFixtures/time';
import { HERITAGE_BARBERS, HERITAGE_PRODUCTS, HERITAGE_SERVICES } from '@/lib/demo/heritage/data';
import {
  getHeritageBookingsForDayKey,
  getHeritageClientDetailResponse,
  getHeritageClientsResponse,
  getHeritageReportsResponse,
  getHeritageRetailLedger,
  getHeritageShopSalesResponse,
  getHeritageTeamResponse,
  resolveHeritageDemoFixture,
} from './index';

// Friday 20 November 2026, 14:10 in London (GMT).
const NOW = new Date('2026-11-20T14:10:00.000Z');
const WEEK = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'];

function minuteOf(iso: string, dayKey: string): number {
  return londonNowMinutes(new Date(iso), dayKey)!;
}

describe('Heritage Grooming demo schedule', () => {
  it('is closed on Sunday and Monday, like the site', () => {
    expect(getHeritageBookingsForDayKey('2026-11-15', { now: NOW })).toEqual([]);
    expect(getHeritageBookingsForDayKey('2026-11-16', { now: NOW })).toEqual([]);
  });

  it('only books each barber on the days the team page lists, inside opening hours, without overlaps', () => {
    for (const dayKey of WEEK) {
      const rows = getHeritageBookingsForDayKey(dayKey, { now: NOW });
      const weekday = new Date(`${dayKey}T12:00:00Z`).getUTCDay();
      const close = weekday === 6 ? 17 * 60 : 19 * 60;
      for (const barber of HERITAGE_BARBERS) {
        const chair = rows.filter((row) => row.barberId === barber.id);
        if (!barber.days.includes(weekday)) expect(chair).toEqual([]);
        const sorted = [...chair].sort((a, b) => a.startAt.localeCompare(b.startAt));
        sorted.forEach((row, index) => {
          expect(minuteOf(row.startAt, dayKey)).toBeGreaterThanOrEqual(9 * 60);
          expect(minuteOf(row.endAt, dayKey)).toBeLessThanOrEqual(close);
          if (index > 0) expect(row.startAt >= sorted[index - 1]!.endAt).toBe(true);
        });
      }
    }
  });

  it('uses only the services and prices on the Heritage price list', () => {
    const rows = WEEK.flatMap((dayKey) => getHeritageBookingsForDayKey(dayKey, { now: NOW }));
    expect(rows.length).toBeGreaterThan(80);
    for (const row of rows) {
      const service = HERITAGE_SERVICES.find((entry) => entry.id === row.serviceId);
      expect(service).toBeDefined();
      expect(row.totalPricePence).toBe(service!.pricePence);
      expect(row.serviceNameAtBooking).toBe(service!.name);
      expect(row.paymentStatus).toBe('NOT_REQUIRED');
    }
  });

  it('shows today as a working day: done before now, still to come after it', () => {
    const today = getHeritageBookingsForDayKey('2026-11-20', { now: NOW });
    const nowMinute = 14 * 60 + 10;
    for (const row of today) {
      if (minuteOf(row.endAt, '2026-11-20') > nowMinute) expect(row.status).toBe('BOOKED');
      else expect(row.status).not.toBe('BOOKED');
    }
    expect(today.some((row) => row.status === 'CANCELLED_BY_CLIENT')).toBe(true);
    expect(today.some((row) => row.status === 'NO_SHOW')).toBe(true);
  });

  it('leaves free chairs on upcoming days, so a visitor can book on the site', () => {
    for (const dayKey of ['2026-11-21', '2026-11-24', '2026-11-25']) {
      const rows = getHeritageBookingsForDayKey(dayKey, { now: NOW }).filter((row) => row.status === 'BOOKED');
      const weekday = new Date(`${dayKey}T12:00:00Z`).getUTCDay();
      const close = weekday === 6 ? 17 * 60 : 19 * 60;
      const gaps = HERITAGE_BARBERS.filter((barber) => barber.days.includes(weekday)).map((barber) => {
        const chair = rows
          .filter((row) => row.barberId === barber.id)
          .map((row) => [minuteOf(row.startAt, dayKey), minuteOf(row.endAt, dayKey)] as const)
          .sort((a, b) => a[0] - b[0]);
        let free = 0;
        let cursor = 9 * 60;
        for (const [start, end] of chair) {
          if (start - cursor >= 45) free += 1;
          cursor = Math.max(cursor, end);
        }
        if (close - cursor >= 45) free += 1;
        return free;
      });
      expect(gaps.reduce((sum, n) => sum + n, 0)).toBeGreaterThanOrEqual(3);
    }
  });

  it('is deterministic for the same day and clock', () => {
    expect(getHeritageBookingsForDayKey('2026-11-18', { now: NOW })).toEqual(
      getHeritageBookingsForDayKey('2026-11-18', { now: NOW }),
    );
  });
});

describe('Heritage Grooming demo team, clients, retail and reports', () => {
  it('lists the four barbers from the site, Arthur as owner', () => {
    const { cards } = getHeritageTeamResponse(NOW);
    expect(cards.map((card) => card.name)).toEqual(HERITAGE_BARBERS.map((barber) => barber.name));
    expect(cards[0]!.role).toBe('OWNER');
  });

  it('has regular clients with history and a working detail view', () => {
    const { clients } = getHeritageClientsResponse(NOW);
    expect(clients.length).toBeGreaterThan(25);
    const regular = clients.find((client) => client.tags.includes('regular'));
    expect(regular).toBeDefined();
    const detail = getHeritageClientDetailResponse(regular!.id, NOW);
    expect(detail?.stats.favouriteService).toBeTruthy();
  });

  it('sells only Heritage shelf products and keeps a few orders waiting at the counter', () => {
    const ledger = getHeritageRetailLedger(NOW);
    expect(ledger.length).toBeGreaterThan(20);
    const productIds = new Set(HERITAGE_PRODUCTS.map((product) => product.id));
    for (const order of ledger) {
      for (const item of order.items) expect(productIds.has(item.productId)).toBe(true);
      expect(order.totalPence).toBe(order.items.reduce((sum, item) => sum + item.lineTotalPence, 0));
      expect(Date.parse(order.createdAt)).toBeLessThanOrEqual(NOW.getTime());
    }
    expect(ledger.some((order) => order.status === 'PAID')).toBe(true);

    const sales = getHeritageShopSalesResponse(new URLSearchParams(), NOW);
    expect(sales.kpis.revenuePence).toBeGreaterThan(0);
    expect(sales.series.overall).toHaveLength(7);
  });

  it('reports a busy week with Heritage barbers and services', () => {
    const report = getHeritageReportsResponse('7d', undefined, undefined, NOW);
    expect(report.bookingsCount).toBeGreaterThan(80);
    expect(report.revenue).toBeGreaterThan(1000);
    expect(report.utilizationPct).toBeGreaterThan(40);
    expect(report.utilizationPct).toBeLessThan(100);
    expect(HERITAGE_BARBERS.map((barber) => barber.name)).toContain(report.busiestBarber?.name);
  });
});

describe('Heritage Grooming demo fixture router', () => {
  it.each([
    'session',
    'team',
    'bookings?date=2026-11-20',
    'bookings?view=history',
    'bookings?view=stats',
    'barbers',
    'barbers/hg-barber-kit/rules',
    'barbers/hg-barber-kit/services',
    'services',
    'service-categories',
    'clients',
    'reports?range=30d',
    'timeblocks',
    'shop/products',
    'shop/orders',
    'shop/sales',
  ])('answers %s', async (path) => {
    const url = new URL(`https://kersivo.local/api/demo/heritage/admin/${path}`);
    const result = await resolveHeritageDemoFixture(url.pathname, url.searchParams, 'GET', undefined, { now: NOW });
    expect(result?.status).toBe(200);
  });

  it('keeps Kit off on Tuesdays in his weekly rules', async () => {
    const result = await resolveHeritageDemoFixture(
      '/api/demo/heritage/admin/barbers/hg-barber-kit/rules',
      new URLSearchParams(),
    );
    const rules = (result!.body as { rules: Array<{ dayOfWeek: number; active: boolean }> }).rules;
    expect(rules.find((rule) => rule.dayOfWeek === 2)?.active).toBe(false);
    expect(rules.find((rule) => rule.dayOfWeek === 5)?.active).toBe(true);
    expect(rules.find((rule) => rule.dayOfWeek === 1)?.active).toBe(false);
  });

  it('ignores the CUTSTATE prefix', async () => {
    expect(await resolveHeritageDemoFixture('/api/demo/admin/team', new URLSearchParams())).toBeNull();
  });
});

describe('Heritage Grooming demo client book', () => {
  it('has unique fictional clients with drama-range phone numbers', async () => {
    const { HERITAGE_PEOPLE } = await import('./catalog');
    expect(new Set(HERITAGE_PEOPLE.map((person) => person.fullName)).size).toBe(HERITAGE_PEOPLE.length);
    expect(new Set(HERITAGE_PEOPLE.map((person) => person.id)).size).toBe(HERITAGE_PEOPLE.length);
    for (const person of HERITAGE_PEOPLE) {
      expect(person.phone).toMatch(/^07700 900\d{3}$/);
      expect(person.email).toMatch(/@example\.com$/);
    }
  });

  it('reads like a real book: most clients came once or twice this month, some are regulars', () => {
    const { clients } = getHeritageClientsResponse(NOW);
    const regulars = clients.filter((client) => client.tags.includes('regular'));
    expect(regulars.length).toBeGreaterThan(5);
    expect(regulars.length).toBeLessThan(clients.length / 2);
  });
});
