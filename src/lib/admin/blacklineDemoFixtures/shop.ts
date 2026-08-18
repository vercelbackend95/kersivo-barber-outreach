import { addMilliseconds } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { DEMO_PRODUCTS } from '@/lib/demo/products';
import { BLACKLINE_PEOPLE, blacklineShopProductsResponse } from './catalog';
import { BLACKLINE_TZ, blacklineDayKey, coarseLondonNow, dayKeyDaysAgo } from './time';

export type BlacklineLedgerOrder = {
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
    nameSnapshot: string;
    unitPricePenceSnapshot: number;
    quantity: number;
    lineTotalPence: number;
  }>;
};

const ORDER_SEEDS: Array<{
  daysAgo: number;
  hour: number;
  minute: number;
  personIndex: number;
  status: 'PAID' | 'COLLECTED';
  skuIndexes: number[];
  quantities: number[];
}> = [
  { daysAgo: 0, hour: 11, minute: 20, personIndex: 4, status: 'PAID', skuIndexes: [0], quantities: [1] },
  { daysAgo: 0, hour: 15, minute: 40, personIndex: 9, status: 'PAID', skuIndexes: [2, 4], quantities: [1, 1] },
  { daysAgo: 1, hour: 10, minute: 5, personIndex: 12, status: 'PAID', skuIndexes: [1], quantities: [2] },
  { daysAgo: 2, hour: 13, minute: 15, personIndex: 7, status: 'COLLECTED', skuIndexes: [5], quantities: [1] },
  { daysAgo: 4, hour: 16, minute: 0, personIndex: 18, status: 'COLLECTED', skuIndexes: [3, 6], quantities: [1, 1] },
  { daysAgo: 6, hour: 12, minute: 30, personIndex: 3, status: 'COLLECTED', skuIndexes: [0, 1], quantities: [1, 1] },
  { daysAgo: 9, hour: 14, minute: 45, personIndex: 21, status: 'COLLECTED', skuIndexes: [4], quantities: [1] },
  { daysAgo: 12, hour: 11, minute: 10, personIndex: 15, status: 'COLLECTED', skuIndexes: [2, 5], quantities: [1, 2] },
];

function orderReference(index: number): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const n = 24000 + index * 37;
  return `BL-${alphabet[index % alphabet.length]}${String(n).slice(0, 4)}${alphabet[(index * 5) % alphabet.length]}`;
}

function buildOrder(seedIndex: number, now: Date): BlacklineLedgerOrder | null {
  const seed = ORDER_SEEDS[seedIndex];
  if (!seed) return null;
  const dayKey = dayKeyDaysAgo(seed.daysAgo, now);
  const person = BLACKLINE_PEOPLE[seed.personIndex % BLACKLINE_PEOPLE.length]!;
  const items = seed.skuIndexes.flatMap((skuIndex, itemIndex) => {
    const product = DEMO_PRODUCTS[skuIndex];
    if (!product) return [];
    const quantity = seed.quantities[itemIndex] ?? 1;
    return [
      {
        id: `bl-item-${seedIndex + 1}-${itemIndex + 1}`,
        nameSnapshot: product.name,
        unitPricePenceSnapshot: product.pricePence,
        quantity,
        lineTotalPence: product.pricePence * quantity,
      },
    ];
  });
  if (items.length === 0) return null;
  const createdAt = fromZonedTime(
    `${dayKey}T${String(seed.hour).padStart(2, '0')}:${String(seed.minute).padStart(2, '0')}:00`,
    BLACKLINE_TZ,
  ).toISOString();
  const totalPence = items.reduce((sum, item) => sum + item.lineTotalPence, 0);
  const reference = orderReference(seedIndex + 1);
  return {
    id: reference,
    reference,
    customerEmail: person.email,
    customerName: person.fullName,
    status: seed.status,
    totalPence,
    currency: 'GBP',
    createdAt,
    paidAt: createdAt,
    collectedAt: seed.status === 'COLLECTED' ? createdAt : null,
    items,
  };
}

export function getBlacklineRetailLedger(now = new Date()): BlacklineLedgerOrder[] {
  const clock = coarseLondonNow(now);
  return ORDER_SEEDS.map((_, index) => buildOrder(index, clock)).filter(
    (order): order is BlacklineLedgerOrder => Boolean(order),
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getBlacklineShopProductDetail(productId: string) {
  const product = blacklineShopProductsResponse.products.find((row) => row.id === productId);
  if (!product) return null;
  return { product };
}

export function getBlacklineShopOrdersList(now = new Date()) {
  const ledger = getBlacklineRetailLedger(now);
  return {
    orders: ledger.map((order) => ({
      id: order.id,
      customerEmail: order.customerEmail,
      status: order.status,
      totalPence: order.totalPence,
      currency: order.currency,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      _count: { items: order.items.length },
    })),
    hasMore: false,
  };
}

export function getBlacklineShopOrderDetail(orderId: string, now = new Date()) {
  const order = getBlacklineRetailLedger(now).find((row) => row.id === orderId || row.reference === orderId);
  if (!order) return null;
  return {
    order: {
      id: order.id,
      customerEmail: order.customerEmail,
      status: order.status,
      totalPence: order.totalPence,
      currency: order.currency,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      collectedAt: order.collectedAt,
      items: order.items,
    },
  };
}

function ymdInRange(ymd: string, fromYmd: string, toYmd: string): boolean {
  return ymd >= fromYmd && ymd <= toYmd;
}

export function getBlacklineShopSalesResponse(searchParams: URLSearchParams, now = new Date()) {
  const clock = coarseLondonNow(now);
  const todayYmd = blacklineDayKey(clock);
  const fromYmd = searchParams.get('from') ?? dayKeyDaysAgo(6, clock);
  const toYmd = searchParams.get('to') ?? todayYmd;

  const ledger = getBlacklineRetailLedger(clock).filter((order) => {
    if (order.status !== 'COLLECTED') return false;
    const ymd = formatInTimeZone(new Date(order.paidAt), BLACKLINE_TZ, 'yyyy-MM-dd');
    return ymdInRange(ymd, fromYmd, toYmd);
  });

  const revenuePence = ledger.reduce((sum, order) => sum + order.totalPence, 0);
  const ordersCount = ledger.length;
  const avgOrderValuePence = ordersCount > 0 ? Math.round(revenuePence / ordersCount) : 0;

  const byProduct = new Map<string, { productId: string; name: string; units: number; revenuePence: number }>();
  for (const order of ledger) {
    for (const item of order.items) {
      const product = DEMO_PRODUCTS.find((row) => row.name === item.nameSnapshot);
      const productId = product?.id ?? `bl-product-${item.nameSnapshot.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const entry = byProduct.get(productId) ?? {
        productId,
        name: item.nameSnapshot,
        units: 0,
        revenuePence: 0,
      };
      entry.units += item.quantity;
      entry.revenuePence += item.lineTotalPence;
      byProduct.set(productId, entry);
    }
  }

  const leaderboard = Array.from(byProduct.values()).sort(
    (a, b) => b.revenuePence - a.revenuePence || b.units - a.units,
  );

  const fromAnchor = fromZonedTime(`${fromYmd}T12:00:00.000`, BLACKLINE_TZ);
  const toAnchor = fromZonedTime(`${toYmd}T12:00:00.000`, BLACKLINE_TZ);
  const daySpan = Math.max(
    1,
    Math.round((toAnchor.getTime() - fromAnchor.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  const chartDays = Math.min(31, daySpan);
  const overall: Array<{ date: string; revenuePence: number; units: number }> = [];
  for (let i = 0; i < chartDays; i += 1) {
    const ymd = formatInTimeZone(addMilliseconds(fromAnchor, i * 24 * 60 * 60 * 1000), BLACKLINE_TZ, 'yyyy-MM-dd');
    if (ymd > toYmd) break;
    const dayOrders = ledger.filter(
      (order) => formatInTimeZone(new Date(order.paidAt), BLACKLINE_TZ, 'yyyy-MM-dd') === ymd,
    );
    overall.push({
      date: ymd,
      revenuePence: dayOrders.reduce((sum, order) => sum + order.totalPence, 0),
      units: dayOrders.reduce(
        (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      ),
    });
  }

  const topProducts = leaderboard.slice(0, 3);
  const seriesProducts = topProducts.map((product) => ({
    productId: product.productId,
    name: product.name,
    points: overall.map((point) => {
      const dayOrders = ledger.filter(
        (order) => formatInTimeZone(new Date(order.paidAt), BLACKLINE_TZ, 'yyyy-MM-dd') === point.date,
      );
      let dayRevenue = 0;
      let dayUnits = 0;
      for (const order of dayOrders) {
        for (const item of order.items) {
          if (item.nameSnapshot !== product.name) continue;
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
      avgOrderValuePence,
      bestProduct: best
        ? {
            productId: best.productId,
            name: best.name,
            revenuePence: best.revenuePence,
            units: best.units,
          }
        : null,
    },
    series: {
      overall,
      products: seriesProducts,
    },
    leaderboard,
  };
}
