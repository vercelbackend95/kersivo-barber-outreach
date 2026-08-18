import { formatInTimeZone } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { DEMO_BARBERS } from '@/lib/demo/barbers';
import { DEMO_PRODUCTS } from '@/lib/demo/products';
import { DEMO_SERVICES } from '@/lib/demo/services';
import {
  getBlacklineBarbersResponse,
  getBlacklineBookingsForDayKey,
  getBlacklineBookingsResponse,
  getBlacklineClientsResponse,
  getBlacklineHistoryBookings,
  getBlacklineReportsResponse,
  getBlacklineRetailLedger,
  getBlacklineShopSalesResponse,
  blacklineServicesResponse,
  blacklineShopProductsResponse,
} from './index';
import { blacklineDayKey, tradingWindow } from './time';

const LONDON_WEDNESDAY = new Date('2026-08-12T12:00:00.000Z'); // Wednesday in London (BST)

describe('BLACKLINE admin fixtures', () => {
  it('reuses the public catalog for barbers, services and products', () => {
    const barbers = getBlacklineBarbersResponse(LONDON_WEDNESDAY).barbers;
    expect(barbers.map((row) => row.id)).toEqual(DEMO_BARBERS.map((row) => row.id));
    expect(barbers.map((row) => row.name)).toEqual(['Ellis Ward', 'Noah Reid', 'Marcus Bell']);
    expect(barbers.some((row) => /Jamie Reed|Alex Morgan|Sam Brooks/.test(row.name))).toBe(false);

    expect(blacklineServicesResponse.services.map((row) => row.id)).toEqual(
      DEMO_SERVICES.map((row) => row.id),
    );
    expect(blacklineShopProductsResponse.products.map((row) => row.id)).toEqual(
      DEMO_PRODUCTS.map((row) => row.id),
    );
    expect(blacklineShopProductsResponse.products).toHaveLength(7);
  });

  it('builds a deterministic working weekday with gaps and no chair overlaps', () => {
    const first = getBlacklineBookingsResponse(
      new URLSearchParams({ date: '2026-08-12', mode: 'day' }),
      LONDON_WEDNESDAY,
    ).bookings;
    const second = getBlacklineBookingsResponse(
      new URLSearchParams({ date: '2026-08-12', mode: 'day' }),
      LONDON_WEDNESDAY,
    ).bookings;

    expect(first.map((row) => row.id)).toEqual(second.map((row) => row.id));
    expect(first.length).toBeGreaterThanOrEqual(18);
    expect(first.length).toBeLessThanOrEqual(22);

    const byBarber = new Map<string, Array<{ start: number; end: number }>>();
    for (const row of first) {
      expect(DEMO_BARBERS.some((barber) => barber.id === row.barberId)).toBe(true);
      expect(DEMO_SERVICES.some((service) => service.id === row.serviceId)).toBe(true);
      const start = new Date(row.startAt).getTime();
      const end = new Date(row.endAt).getTime();
      const busy = byBarber.get(row.barberId) ?? [];
      expect(busy.some((interval) => start < interval.end && end > interval.start)).toBe(false);
      busy.push({ start, end });
      byBarber.set(row.barberId, busy);
    }
  });

  it('includes an in-progress visit during open hours and none after close', () => {
    const midday = new Date('2026-08-12T12:00:00.000Z'); // 13:00 Europe/London
    const openBookings = getBlacklineBookingsResponse(
      new URLSearchParams({ date: '2026-08-12', mode: 'day' }),
      midday,
    ).bookings;
    const nowMs = midday.getTime();
    expect(
      openBookings.some(
        (row) => new Date(row.startAt).getTime() <= nowMs && nowMs < new Date(row.endAt).getTime(),
      ),
    ).toBe(true);

    const afterHours = getBlacklineBookingsResponse(
      new URLSearchParams({ date: '2026-08-12', mode: 'day' }),
      new Date('2026-08-12T19:30:00.000Z'),
    ).bookings;
    const afterMs = new Date('2026-08-12T19:30:00.000Z').getTime();
    expect(
      afterHours.some(
        (row) => new Date(row.startAt).getTime() <= afterMs && afterMs < new Date(row.endAt).getTime(),
      ),
    ).toBe(false);
  });

  it('closes Sunday and keeps Saturday inside 09:00–17:00', () => {
    expect(tradingWindow('2026-08-16')).toBeNull();
    expect(getBlacklineBookingsForDayKey('2026-08-16', { now: new Date('2026-08-16T12:00:00.000Z') })).toEqual([]);

    const saturday = getBlacklineBookingsForDayKey('2026-08-15', {
      now: new Date('2026-08-15T12:00:00.000Z'),
      forHistory: true,
    });
    expect(saturday.length).toBeGreaterThan(0);
    for (const row of saturday) {
      const endHour = Number(formatInTimeZone(new Date(row.endAt), 'Europe/London', 'H'));
      const endMinute = Number(formatInTimeZone(new Date(row.endAt), 'Europe/London', 'm'));
      expect(endHour * 60 + endMinute).toBeLessThanOrEqual(17 * 60);
    }
    expect(blacklineDayKey(LONDON_WEDNESDAY)).toBe('2026-08-12');
  });

  it('derives reports, orders and sales from the same fixture records', () => {
    const history = getBlacklineHistoryBookings(30, LONDON_WEDNESDAY);
    expect(history.length).toBeGreaterThan(30);

    const reports = getBlacklineReportsResponse('30d', undefined, undefined, LONDON_WEDNESDAY);
    expect(reports.bookingsCount).toBeGreaterThan(0);
    expect(reports.completedServiceValueGbp).toBeGreaterThan(0);
    expect(reports.bookedServiceValueGbp).toBeGreaterThanOrEqual(reports.completedServiceValueGbp);
    expect(reports.recentBarbers.map((row) => row.name)).toEqual([
      'Ellis Ward',
      'Noah Reid',
      'Marcus Bell',
    ]);
    expect(DEMO_SERVICES.some((service) => service.name === reports.mostPopularService?.name)).toBe(true);

    const orders = getBlacklineRetailLedger(LONDON_WEDNESDAY);
    expect(orders.length).toBeGreaterThanOrEqual(6);
    expect(orders.length).toBeLessThanOrEqual(10);
    expect(orders.filter((row) => row.status === 'PAID').length).toBeGreaterThanOrEqual(2);
    expect(orders.filter((row) => row.status === 'PAID').length).toBeLessThanOrEqual(3);
    expect(orders.every((row) => row.customerEmail.endsWith('@example.com'))).toBe(true);

    const sales = getBlacklineShopSalesResponse(
      new URLSearchParams({ from: '2026-07-01', to: '2026-08-12' }),
      LONDON_WEDNESDAY,
    );
    expect(sales.kpis.ordersCount).toBe(orders.filter((row) => row.status === 'COLLECTED').length);
    expect(sales.kpis.revenuePence).toBe(
      orders.filter((row) => row.status === 'COLLECTED').reduce((sum, row) => sum + row.totalPence, 0),
    );

    const clients = getBlacklineClientsResponse(LONDON_WEDNESDAY).clients;
    expect(clients.length).toBeGreaterThan(8);
    expect(new Set(clients.map((row) => row.email)).size).toBe(clients.length);
  });
});
