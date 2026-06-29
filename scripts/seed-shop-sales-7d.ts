import { OrderStatus, PrismaClient } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';
import { toUtcFromLondon } from '../src/lib/booking/time';

const prisma = new PrismaClient();

const LONDON_TZ = 'Europe/London';
const DEMO_SHOP_ID = 'demo-shop';
const LEGACY_DEMO_EMAIL_PREFIX = 'demo+shop-sales-';
const DEMO_EMAIL_TAG = '+demo-';

const DEMO_CUSTOMER_EMAILS = [
  'oliver.reed@example.com',
  'amelia.clarke@example.com',
  'noah.bennett@example.com',
  'isla.morgan@example.com',
  'leo.carter@example.com',
  'maya.brooks@example.com',
  'theo.hughes@example.com',
  'grace.turner@example.com'
];

type ProductRow = { id: string; name: string; pricePence: number };

type OrderLineDraft = {
  productId: string;
  nameSnapshot: string;
  unitPricePenceSnapshot: number;
  quantity: number;
  lineTotalPence: number;
};

type OrderDraft = {
  customerEmail: string;
  status: OrderStatus;
  paidAt: Date;
  items: OrderLineDraft[];
  totalPence: number;
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function resolveTargetRevenuePence(): number {
  const raw = Number.parseFloat(process.env.TARGET_REVENUE_GBP ?? '1000');
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error('TARGET_REVENUE_GBP must be a positive number.');
  }
  return Math.round(raw * 100);
}

function resolveWindowDays(): number {
  const raw = Number.parseInt(process.env.WINDOW_DAYS ?? '7', 10);
  if (!Number.isFinite(raw) || raw < 1) {
    throw new Error('WINDOW_DAYS must be a positive integer.');
  }
  return raw;
}

function shouldClearDemo(): boolean {
  const raw = (process.env.CLEAR_DEMO ?? '1').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'no';
}

function listLondonDays(windowDays: number): string[] {
  const days: string[] = [];
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    days.push(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: LONDON_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date)
    );
  }
  return days;
}

function dayRangeUtc(ymd: string): { start: Date; endExclusive: Date } {
  const start = fromZonedTime(`${ymd}T00:00:00`, LONDON_TZ);
  const endExclusive = fromZonedTime(`${ymd}T00:00:00`, LONDON_TZ);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return { start, endExclusive };
}

function gcd(a: number, b: number): number {
  let left = a;
  let right = b;
  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left;
}

function priceStep(products: ProductRow[]): number {
  return products.reduce((step, product) => gcd(step, product.pricePence), products[0].pricePence);
}

function allocateDailyTargets(totalPence: number, dayCount: number, step: number): number[] {
  const adjustedTotal = Math.round(totalPence / step) * step;
  const weights = Array.from({ length: dayCount }, () => randomInt(80, 140));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => (adjustedTotal * weight) / weightSum);
  const floored = raw.map((value) => Math.floor(value / step) * step);
  let remainder = adjustedTotal - floored.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - floored[index] }))
    .sort((a, b) => b.fraction - a.fraction);

  for (const entry of order) {
    if (remainder < step) break;
    floored[entry.index] += step;
    remainder -= step;
  }

  if (remainder !== 0) {
    floored[floored.length - 1] += remainder;
  }

  return floored;
}

function toLine(product: ProductRow, quantity: number): OrderLineDraft {
  return {
    productId: product.id,
    nameSnapshot: product.name,
    unitPricePenceSnapshot: product.pricePence,
    quantity,
    lineTotalPence: product.pricePence * quantity
  };
}

function findLinesForAmount(amount: number, products: ProductRow[], maxLines = 3): OrderLineDraft[] | null {
  if (amount <= 0) return [];

  for (const product of products) {
    if (amount % product.pricePence !== 0) continue;
    const quantity = amount / product.pricePence;
    if (quantity >= 1 && quantity <= 6) {
      return [toLine(product, quantity)];
    }
  }

  if (maxLines < 2) return null;

  for (const first of products) {
    for (let qty = 1; qty <= 3; qty += 1) {
      const remainder = amount - first.pricePence * qty;
      if (remainder <= 0) continue;
      const tail = findLinesForAmount(remainder, products, maxLines - 1);
      if (tail) {
        return [toLine(first, qty), ...tail];
      }
    }
  }

  return null;
}

function buildSingleOrderAchievable(maxAmount: number, products: ProductRow[], step: number): boolean[] {
  const achievable = new Array<boolean>(maxAmount + 1).fill(false);
  for (let amount = step; amount <= maxAmount; amount += step) {
    achievable[amount] = findLinesForAmount(amount, products) !== null;
  }
  return achievable;
}

function createSplittableChecker(achievable: boolean[], minPrice: number, step: number) {
  const memo = new Map<string, boolean>();

  function canSplit(amount: number, parts: number): boolean {
    if (parts <= 0) return false;
    if (parts === 1) return Boolean(achievable[amount]);
    if (amount < parts * minPrice) return false;

    const key = `${amount}:${parts}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    for (let chunk = minPrice; chunk <= amount - (parts - 1) * minPrice; chunk += step) {
      if (!achievable[chunk]) continue;
      if (canSplit(amount - chunk, parts - 1)) {
        memo.set(key, true);
        return true;
      }
    }

    memo.set(key, false);
    return false;
  }

  return canSplit;
}

function splitDayTarget(
  target: number,
  achievable: boolean[],
  minPrice: number,
  step: number,
  canSplit: (amount: number, parts: number) => boolean
): number[] {
  const preferredCounts = [randomInt(5, 9), 6, 7, 8, 5, 4, 9, 10, 11];
  const orderCount = preferredCounts.find((count) => canSplit(target, count));

  if (!orderCount) {
    throw new Error(`Could not split daily target of ${target} pence into achievable orders.`);
  }

  const amounts: number[] = [];
  let remaining = target;

  for (let index = 0; index < orderCount - 1; index += 1) {
    const partsLeft = orderCount - index;
    const minReserve = (partsLeft - 1) * minPrice;
    const maxChunk = remaining - minReserve;
    const candidates: number[] = [];

    for (let chunk = minPrice; chunk <= maxChunk; chunk += step) {
      if (!achievable[chunk]) continue;
      if (canSplit(remaining - chunk, partsLeft - 1)) {
        candidates.push(chunk);
      }
    }

    if (candidates.length === 0) {
      throw new Error(`Could not split ${remaining} pence into ${partsLeft} achievable order(s).`);
    }

    const picked = candidates[randomInt(0, candidates.length - 1)];
    amounts.push(picked);
    remaining -= picked;
  }

  if (!achievable[remaining]) {
    throw new Error(`Final daily remainder ${remaining} pence is not achievable as a single order.`);
  }

  amounts.push(remaining);
  return amounts;
}

function createOrderFromAmount(
  amount: number,
  products: ProductRow[],
  dayYmd: string,
  customerEmail: string
): OrderDraft {
  const items = findLinesForAmount(amount, products);
  if (!items || items.length === 0) {
    throw new Error(`Amount ${amount} pence is not achievable.`);
  }

  const hour = randomInt(9, 18);
  const minute = randomInt(0, 5) * 10;
  const paidAt = toUtcFromLondon(dayYmd, hour * 60 + minute);
  const status: OrderStatus = Math.random() < 0.15 ? 'COLLECTED' : 'PAID';

  return {
    customerEmail,
    status,
    paidAt,
    items,
    totalPence: amount
  };
}

function createOrdersForDay(
  dayTargetPence: number,
  products: ProductRow[],
  dayYmd: string,
  emailOffset: number,
  achievable: boolean[],
  minPrice: number,
  step: number,
  canSplit: (amount: number, parts: number) => boolean
): OrderDraft[] {
  const amounts = splitDayTarget(dayTargetPence, achievable, minPrice, step, canSplit);

  return amounts.map((amount, index) =>
    createOrderFromAmount(
      amount,
      products,
      dayYmd,
      DEMO_CUSTOMER_EMAILS[(emailOffset + index) % DEMO_CUSTOMER_EMAILS.length]
    )
  );
}

function demoOrderWhere() {
  return {
    OR: [
      { customerEmail: { startsWith: LEGACY_DEMO_EMAIL_PREFIX } },
      { customerEmail: { contains: DEMO_EMAIL_TAG } },
      { customerEmail: { in: DEMO_CUSTOMER_EMAILS } }
    ]
  };
}

async function main() {
  const targetRevenuePence = resolveTargetRevenuePence();
  const windowDays = resolveWindowDays();
  const days = listLondonDays(windowDays);

  const products = await prisma.product.findMany({
    where: { shopId: DEMO_SHOP_ID, active: true },
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
    select: { id: true, name: true, pricePence: true }
  });

  if (products.length === 0) {
    throw new Error('No active products found for demo-shop. Add products in admin first.');
  }

  if (shouldClearDemo()) {
    const windowStart = dayRangeUtc(days[0]).start;
    const windowEnd = dayRangeUtc(days[days.length - 1]).endExclusive;
    const deleted = await prisma.order.deleteMany({
      where: {
        shopId: DEMO_SHOP_ID,
        ...demoOrderWhere(),
        paidAt: {
          gte: windowStart,
          lt: windowEnd
        }
      }
    });
    console.info(`[shop-sales-7d] Cleared ${deleted.count} existing demo order(s) in window.`);
  }

  const step = priceStep(products);
  const minPrice = Math.min(...products.map((product) => product.pricePence));
  const dailyTargets = allocateDailyTargets(targetRevenuePence, days.length, step);
  const maxDailyTarget = Math.max(...dailyTargets);
  const achievable = buildSingleOrderAchievable(maxDailyTarget, products, step);
  const canSplit = createSplittableChecker(achievable, minPrice, step);

  for (const dayTarget of dailyTargets) {
    if (!canSplit(dayTarget, 4)) {
      throw new Error(
        `Daily target ${dayTarget} pence is not splittable with current product prices. Adjust TARGET_REVENUE_GBP or add products.`
      );
    }
  }

  const allOrders: OrderDraft[] = [];

  for (let index = 0; index < days.length; index += 1) {
    const dayOrders = createOrdersForDay(
      dailyTargets[index],
      products,
      days[index],
      index,
      achievable,
      minPrice,
      step,
      canSplit
    );
    allOrders.push(...dayOrders);
  }

  const created = await prisma.$transaction(
    allOrders.map((order) =>
      prisma.order.create({
        data: {
          shopId: DEMO_SHOP_ID,
          customerEmail: order.customerEmail,
          status: order.status,
          currency: 'gbp',
          totalPence: order.totalPence,
          paidAt: order.paidAt,
          createdAt: order.paidAt,
          collectedAt: order.status === 'COLLECTED' ? order.paidAt : null,
          items: {
            create: order.items
          }
        }
      })
    )
  );

  const totalPence = allOrders.reduce((sum, order) => sum + order.totalPence, 0);
  const revenueByDay = new Map<string, number>();

  for (let index = 0; index < days.length; index += 1) {
    revenueByDay.set(days[index], dailyTargets[index]);
  }

  console.info(`[shop-sales-7d] Created ${created.length} order(s).`);
  console.info(`[shop-sales-7d] Total revenue: £${(totalPence / 100).toFixed(2)} (target £${(targetRevenuePence / 100).toFixed(2)}).`);
  console.info(
    `[shop-sales-7d] Avg order value: £${(totalPence / created.length / 100).toFixed(2)} across ${windowDays} day(s).`
  );
  console.info('[shop-sales-7d] Revenue by day (Europe/London):');
  for (const day of days) {
    const amount = revenueByDay.get(day) ?? 0;
    console.info(`  ${day}: £${(amount / 100).toFixed(2)}`);
  }
  console.info(`[shop-sales-7d] Range: ${days[0]} → ${days[days.length - 1]}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[shop-sales-7d] Failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
