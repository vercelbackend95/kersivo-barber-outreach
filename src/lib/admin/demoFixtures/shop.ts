import { addMilliseconds } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { getDemoCatalogProducts } from '../../shop/demoCatalog';
import { createDemoPrng, dayKeyDaysAgo } from './bookingCalendar';
import { DEMO_PRODUCT_IDS } from './ids';

const TZ = 'Europe/London';

const CATALOG = getDemoCatalogProducts({ activeOnly: false });
const PRODUCT_BY_ID = new Map(CATALOG.map((p) => [p.id, p]));

type LedgerLine = {
  productId: string;
  name: string;
  unitPricePence: number;
  quantity: number;
};

export type DemoLedgerOrder = {
  id: string;
  reference: string;
  customerEmail: string;
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

const CUSTOMER_EMAILS = [
  'oliver.reed@example.com',
  'amelia.clarke@example.com',
  'noah.bennett@example.com',
  'harry.watson@example.com',
  'maya.brooks@example.com',
];

const SKU_ROTATION = [
  DEMO_PRODUCT_IDS.mattePomade,
  DEMO_PRODUCT_IDS.beardOil,
  DEMO_PRODUCT_IDS.forgeStylingPowder,
  DEMO_PRODUCT_IDS.mattePomade,
  DEMO_PRODUCT_IDS.beardOil,
  DEMO_PRODUCT_IDS.dailyWash,
  DEMO_PRODUCT_IDS.forgeStylingPowder,
  DEMO_PRODUCT_IDS.mattePomade,
] as const;

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function orderReferenceFromIndex(index: number): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const n = 10000 + ((index * 7919) % 80000);
  const a = alphabet[index % alphabet.length]!;
  const b = alphabet[(index * 3) % alphabet.length]!;
  return `ORD-${String(n).slice(0, 2)}${a}${String(n).slice(2)}${b}`.replace(/[^A-Z0-9-]/gi, '').slice(0, 11);
}

function buildLines(seed: number, count: number): LedgerLine[] {
  const lines: LedgerLine[] = [];
  for (let i = 0; i < count; i += 1) {
    const productId = SKU_ROTATION[(seed + i) % SKU_ROTATION.length]!;
    const product = PRODUCT_BY_ID.get(productId);
    if (!product) continue;
    const quantity = 1 + ((seed + i) % 2);
    lines.push({
      productId: product.id,
      name: product.name,
      unitPricePence: product.pricePence,
      quantity,
    });
  }
  return lines;
}

/** Deterministic retail ledger for the last ~30 London days. */
export function getDemoRetailLedger(now = new Date()): DemoLedgerOrder[] {
  const prng = createDemoPrng(hashString('kersivo-demo-retail-v1'));
  const orders: DemoLedgerOrder[] = [];
  let orderIndex = 0;

  for (let ago = 29; ago >= 0; ago -= 1) {
    const dayKey = dayKeyDaysAgo(ago, now);
    const weekday = Number(
      formatInTimeZone(fromZonedTime(`${dayKey}T12:00:00.000`, TZ), TZ, 'i'),
    );
    const base = weekday >= 6 ? 2 : 1;
    const extra = prng() > 0.55 ? 1 : 0;
    const orderCount = Math.max(0, Math.min(3, base + extra - (weekday === 7 ? 1 : 0)));

    for (let o = 0; o < orderCount; o += 1) {
      orderIndex += 1;
      const lineCount = 1 + Math.floor(prng() * 2);
      const lines = buildLines(orderIndex * 17 + o, lineCount);
      if (lines.length === 0) continue;

      const items = lines.map((line, itemIndex) => ({
        id: `demo-item-${orderIndex}-${itemIndex + 1}`,
        nameSnapshot: line.name,
        unitPricePenceSnapshot: line.unitPricePence,
        quantity: line.quantity,
        lineTotalPence: line.unitPricePence * line.quantity,
      }));
      const totalPence = items.reduce((sum, item) => sum + item.lineTotalPence, 0);
      const hour = 10 + Math.floor(prng() * 8);
      const minute = [0, 15, 30, 45][Math.floor(prng() * 4)]!;
      const createdAt = fromZonedTime(
        `${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
        TZ,
      ).toISOString();
      const status: 'PAID' | 'COLLECTED' = prng() > 0.35 ? 'COLLECTED' : 'PAID';
      const reference = orderReferenceFromIndex(orderIndex);

      orders.push({
        id: reference,
        reference,
        customerEmail: CUSTOMER_EMAILS[(orderIndex + o) % CUSTOMER_EMAILS.length]!,
        status,
        totalPence,
        currency: 'GBP',
        createdAt,
        paidAt: createdAt,
        collectedAt: status === 'COLLECTED' ? createdAt : null,
        items,
      });
    }
  }

  return orders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

const nowIso = () => new Date().toISOString();

export const demoShopProductsResponse = {
  products: CATALOG.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    pricePence: product.pricePence,
    imageUrl: product.imageUrl,
    active: product.active,
    featured: product.featured,
    category: product.category,
    sortOrder: product.sortOrder,
    updatedAt: product.updatedAt || nowIso(),
  })),
};

export function getDemoShopProductDetail(productId: string) {
  const product = demoShopProductsResponse.products.find((p) => p.id === productId);
  if (!product) return null;
  return { product };
}

export function getDemoShopOrdersList(now = new Date()) {
  const ledger = getDemoRetailLedger(now);
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

/** Lazy getter-compatible export for clients.ts join. */
export const demoShopOrdersResponse = {
  get orders() {
    return getDemoShopOrdersList().orders;
  },
  hasMore: false as const,
};

export function getDemoShopOrderDetail(orderId: string, now = new Date()) {
  const order = getDemoRetailLedger(now).find((o) => o.id === orderId || o.reference === orderId);
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

export function getDemoShopSalesResponse(searchParams: URLSearchParams, now = new Date()) {
  const todayYmd = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
  const fromYmd = searchParams.get('from') ?? dayKeyDaysAgo(6, now);
  const toYmd = searchParams.get('to') ?? todayYmd;

  const ledger = getDemoRetailLedger(now).filter((order) => {
    const ymd = formatInTimeZone(new Date(order.paidAt), TZ, 'yyyy-MM-dd');
    return ymdInRange(ymd, fromYmd, toYmd);
  });

  const revenuePence = ledger.reduce((sum, order) => sum + order.totalPence, 0);
  const ordersCount = ledger.length;
  const avgOrderValuePence = ordersCount > 0 ? Math.round(revenuePence / ordersCount) : 0;

  const byProduct = new Map<
    string,
    { productId: string; name: string; units: number; revenuePence: number }
  >();
  for (const order of ledger) {
    for (const item of order.items) {
      const product = CATALOG.find((p) => p.name === item.nameSnapshot);
      const productId =
        product?.id ??
        `demo-product-${item.nameSnapshot.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
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

  const fromAnchor = fromZonedTime(`${fromYmd}T12:00:00.000`, TZ);
  const toAnchor = fromZonedTime(`${toYmd}T12:00:00.000`, TZ);
  const daySpan = Math.max(
    1,
    Math.round((toAnchor.getTime() - fromAnchor.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  const chartDays = Math.min(31, daySpan);
  const overall: Array<{ date: string; revenuePence: number; units: number }> = [];
  for (let i = 0; i < chartDays; i += 1) {
    const ymd = formatInTimeZone(
      addMilliseconds(fromAnchor, i * 24 * 60 * 60 * 1000),
      TZ,
      'yyyy-MM-dd',
    );
    if (ymd > toYmd) break;
    const dayOrders = ledger.filter(
      (order) => formatInTimeZone(new Date(order.paidAt), TZ, 'yyyy-MM-dd') === ymd,
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
        (order) => formatInTimeZone(new Date(order.paidAt), TZ, 'yyyy-MM-dd') === point.date,
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
    range: { from: fromYmd, to: toYmd, tz: TZ },
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
