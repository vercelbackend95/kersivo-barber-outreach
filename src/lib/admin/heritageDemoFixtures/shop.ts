import { addMilliseconds } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  BLACKLINE_TZ,
  atDayMinute,
  blacklineDayKey,
  coarseLondonNow,
  createPrng,
  dayKeyDaysAgo,
  hashString,
  londonNowMinutes,
} from '@/lib/admin/blacklineDemoFixtures/time';
import {
  HERITAGE_PRODUCTS,
  getHeritageService,
  type HeritageProduct,
  type HeritageProductShelf,
} from '@/lib/demo/heritage/data';
import { HERITAGE_PEOPLE, heritageShopProductsResponse, heritageTradingWindow } from './catalog';
import { getHeritageBookingsForDayKey, type HeritageBooking } from './schedule';

export type HeritageLedgerOrder = {
  id: string;
  reference: string;
  customerEmail: string;
  customerName: string;
  status: 'PAID' | 'COLLECTED';
  totalPence: number;
  currency: 'GBP';
  createdAt: string;
  paidAt: string;
  collectedAt: string | null;
  items: Array<{
    id: string;
    productId: string;
    nameSnapshot: string;
    unitPricePenceSnapshot: number;
    quantity: number;
    lineTotalPence: number;
  }>;
};

/** How far back the retail ledger goes (sales chart covers up to 31 days, client history 30). */
export const HERITAGE_LEDGER_DAYS = 60;

/** Which shelf a client reaches for after a given service. */
const SHELF_BY_CATEGORY: Readonly<Record<string, readonly HeritageProductShelf[]>> = {
  Haircuts: ['hair'],
  Beards: ['beard'],
  'Straight razor': ['shave', 'skin'],
  Combinations: ['hair', 'beard'],
  'Under twelves': ['hair'],
};

function pickProduct(shelves: readonly HeritageProductShelf[], roll: number, exclude: Set<string>): HeritageProduct | null {
  const pool = HERITAGE_PRODUCTS.filter((product) => shelves.includes(product.cat) && !exclude.has(product.id));
  if (pool.length === 0) return null;
  // The six on the counter sell three times as often as the rest of the shelf.
  const weighted = pool.flatMap((product) => (product.featured ? [product, product, product] : [product]));
  return weighted[Math.floor(roll * weighted.length)] ?? null;
}

function basket(shelves: readonly HeritageProductShelf[], prng: () => number, orderKey: string): HeritageLedgerOrder['items'] {
  const size = prng() < 0.62 ? 1 : prng() < 0.85 ? 2 : 3;
  const chosen = new Set<string>();
  const items: HeritageLedgerOrder['items'] = [];
  for (let index = 0; index < size; index += 1) {
    const product = pickProduct(index === 0 ? shelves : [...shelves, 'skin'], prng(), chosen);
    if (!product) continue;
    chosen.add(product.id);
    const quantity = product.pricePence <= 1200 && prng() < 0.3 ? 2 : 1;
    items.push({
      id: `${orderKey}-item-${index + 1}`,
      productId: product.id,
      nameSnapshot: product.name,
      unitPricePenceSnapshot: product.pricePence,
      quantity,
      lineTotalPence: product.pricePence * quantity,
    });
  }
  return items;
}

function order(
  reference: string,
  person: { fullName: string; email: string },
  items: HeritageLedgerOrder['items'],
  createdAt: string,
  status: HeritageLedgerOrder['status'],
): HeritageLedgerOrder {
  return {
    id: reference,
    reference,
    customerEmail: person.email,
    customerName: person.fullName,
    status,
    totalPence: items.reduce((sum, item) => sum + item.lineTotalPence, 0),
    currency: 'GBP',
    createdAt,
    paidAt: createdAt,
    collectedAt: status === 'COLLECTED' ? createdAt : null,
    items,
  };
}

/**
 * One trading day of retail: a share of the clients who sat in the chair buy at the counter afterwards
 * (paid and collected), and a few reserve online for collection on a later visit.
 */
function ordersForDay(dayKey: string, daysAgo: number, now: Date): HeritageLedgerOrder[] {
  const window = heritageTradingWindow(dayKey);
  if (!window) return [];
  const prng = createPrng(hashString(`heritage-retail|${dayKey}`));
  const compact = dayKey.slice(5).replace('-', ''); // MMDD: references stay short enough for the orders table
  const nowMinute = londonNowMinutes(now, dayKey);
  const bookings: HeritageBooking[] = getHeritageBookingsForDayKey(dayKey, { now, forHistory: daysAgo > 0 });
  const rows: HeritageLedgerOrder[] = [];

  for (const booking of bookings) {
    if (booking.status !== 'COMPLETED') continue;
    if (prng() > 0.16) continue;
    const service = getHeritageService(booking.serviceId);
    const shelves = SHELF_BY_CATEGORY[service?.category ?? ''] ?? ['hair'];
    const reference = `HG-${compact}${String(rows.length + 1).padStart(2, '0')}`;
    const items = basket(shelves, prng, reference);
    if (items.length === 0) continue;
    const paidAt = new Date(new Date(booking.endAt).getTime() + 4 * 60 * 1000).toISOString();
    rows.push(order(reference, { fullName: booking.fullName, email: booking.email }, items, paidAt, 'COLLECTED'));
  }

  // Online reservations from the last few days still waiting at the counter.
  if (daysAgo <= 3 && prng() < 0.75) {
    const minute = window.openMinute + 30 + Math.floor(prng() * (window.closeMinute - window.openMinute - 60));
    if (nowMinute == null || minute < nowMinute) {
      const person = HERITAGE_PEOPLE[Math.floor(prng() * HERITAGE_PEOPLE.length)]!;
      const reference = `HG-${compact}${String(rows.length + 1).padStart(2, '0')}`;
      const items = basket(prng() < 0.5 ? ['hair'] : ['beard'], prng, reference);
      if (items.length > 0) rows.push(order(reference, person, items, atDayMinute(dayKey, minute), 'PAID'));
    }
  }

  return rows;
}

const ledgerCache = new Map<string, HeritageLedgerOrder[]>();

export function getHeritageRetailLedger(now = new Date()): HeritageLedgerOrder[] {
  const clock = coarseLondonNow(now);
  const cacheKey = clock.toISOString();
  const cached = ledgerCache.get(cacheKey);
  if (cached) return cached.map((row) => ({ ...row, items: row.items.map((item) => ({ ...item })) }));

  const rows: HeritageLedgerOrder[] = [];
  for (let ago = HERITAGE_LEDGER_DAYS - 1; ago >= 0; ago -= 1) {
    rows.push(...ordersForDay(dayKeyDaysAgo(ago, clock), ago, clock));
  }
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (ledgerCache.size >= 8) ledgerCache.clear();
  ledgerCache.set(cacheKey, rows);
  return rows.map((row) => ({ ...row, items: row.items.map((item) => ({ ...item })) }));
}

export function getHeritageShopProductDetail(productId: string) {
  const product = heritageShopProductsResponse.products.find((row) => row.id === productId);
  if (!product) return null;
  return { product };
}

export function getHeritageShopOrdersList(now = new Date()) {
  return {
    orders: getHeritageRetailLedger(now).map((row) => ({
      id: row.id,
      customerEmail: row.customerEmail,
      status: row.status,
      totalPence: row.totalPence,
      currency: row.currency,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      _count: { items: row.items.length },
    })),
    hasMore: false,
  };
}

export function getHeritageShopOrderDetail(orderId: string, now = new Date()) {
  const row = getHeritageRetailLedger(now).find((entry) => entry.id === orderId || entry.reference === orderId);
  if (!row) return null;
  return {
    order: {
      id: row.id,
      customerEmail: row.customerEmail,
      status: row.status,
      totalPence: row.totalPence,
      currency: row.currency,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      collectedAt: row.collectedAt,
      items: row.items.map(({ productId: _productId, ...item }) => item),
    },
  };
}

function londonYmd(iso: string): string {
  return formatInTimeZone(new Date(iso), BLACKLINE_TZ, 'yyyy-MM-dd');
}

export function getHeritageShopSalesResponse(searchParams: URLSearchParams, now = new Date()) {
  const clock = coarseLondonNow(now);
  const todayYmd = blacklineDayKey(clock);
  const fromYmd = searchParams.get('from') ?? dayKeyDaysAgo(6, clock);
  const toYmd = searchParams.get('to') ?? todayYmd;

  const ledger = getHeritageRetailLedger(clock).filter((row) => {
    if (row.status !== 'COLLECTED') return false;
    const ymd = londonYmd(row.paidAt);
    return ymd >= fromYmd && ymd <= toYmd;
  });

  const revenuePence = ledger.reduce((sum, row) => sum + row.totalPence, 0);
  const ordersCount = ledger.length;

  const byProduct = new Map<string, { productId: string; name: string; units: number; revenuePence: number }>();
  for (const row of ledger) {
    for (const item of row.items) {
      const entry = byProduct.get(item.productId) ?? {
        productId: item.productId,
        name: item.nameSnapshot,
        units: 0,
        revenuePence: 0,
      };
      entry.units += item.quantity;
      entry.revenuePence += item.lineTotalPence;
      byProduct.set(item.productId, entry);
    }
  }
  const leaderboard = [...byProduct.values()].sort((a, b) => b.revenuePence - a.revenuePence || b.units - a.units);

  const fromAnchor = fromZonedTime(`${fromYmd}T12:00:00.000`, BLACKLINE_TZ);
  const toAnchor = fromZonedTime(`${toYmd}T12:00:00.000`, BLACKLINE_TZ);
  const daySpan = Math.max(1, Math.round((toAnchor.getTime() - fromAnchor.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const chartDays = Math.min(31, daySpan);
  const overall: Array<{ date: string; revenuePence: number; units: number }> = [];
  for (let i = 0; i < chartDays; i += 1) {
    const ymd = formatInTimeZone(addMilliseconds(fromAnchor, i * 24 * 60 * 60 * 1000), BLACKLINE_TZ, 'yyyy-MM-dd');
    if (ymd > toYmd) break;
    const dayOrders = ledger.filter((row) => londonYmd(row.paidAt) === ymd);
    overall.push({
      date: ymd,
      revenuePence: dayOrders.reduce((sum, row) => sum + row.totalPence, 0),
      units: dayOrders.reduce((sum, row) => sum + row.items.reduce((n, item) => n + item.quantity, 0), 0),
    });
  }

  const seriesProducts = leaderboard.slice(0, 3).map((product) => ({
    productId: product.productId,
    name: product.name,
    points: overall.map((point) => {
      let dayRevenue = 0;
      let dayUnits = 0;
      for (const row of ledger) {
        if (londonYmd(row.paidAt) !== point.date) continue;
        for (const item of row.items) {
          if (item.productId !== product.productId) continue;
          dayRevenue += item.lineTotalPence;
          dayUnits += item.quantity;
        }
      }
      return { date: point.date, revenuePence: dayRevenue, units: dayUnits };
    }),
  }));

  const best = leaderboard[0] ?? null;
  return {
    range: { from: fromYmd, to: toYmd, tz: BLACKLINE_TZ },
    kpis: {
      revenuePence,
      ordersCount,
      avgOrderValuePence: ordersCount > 0 ? Math.round(revenuePence / ordersCount) : 0,
      bestProduct: best
        ? { productId: best.productId, name: best.name, revenuePence: best.revenuePence, units: best.units }
        : null,
    },
    series: { overall, products: seriesProducts },
    leaderboard,
  };
}
