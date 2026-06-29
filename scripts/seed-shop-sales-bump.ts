import { PrismaClient } from '@prisma/client';
import {
  DEMO_CUSTOMER_EMAILS,
  DEMO_SHOP_ID,
  createSingleProductOrder,
  listLondonDays,
  randomInt,
  type ProductRow
} from './lib/shopSalesSeed';

const prisma = new PrismaClient();

function resolveOrderCount(): number {
  const raw = Number.parseInt(process.env.ORDER_COUNT ?? '3', 10);
  if (!Number.isFinite(raw) || raw < 1) {
    throw new Error('ORDER_COUNT must be a positive integer.');
  }
  return raw;
}

function resolveWindowDays(): number {
  const raw = Number.parseInt(process.env.WINDOW_DAYS ?? '7', 10);
  if (!Number.isFinite(raw) || raw < 1) {
    throw new Error('WINDOW_DAYS must be a positive integer.');
  }
  return raw;
}

async function main() {
  const orderCount = resolveOrderCount();
  const windowDays = resolveWindowDays();
  const days = listLondonDays(windowDays);

  const products = await prisma.product.findMany({
    where: { shopId: DEMO_SHOP_ID, active: true },
    orderBy: [{ pricePence: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, name: true, pricePence: true }
  });

  if (products.length === 0) {
    throw new Error('No active products found for demo-shop. Add products in admin first.');
  }

  const shuffled = [...products].sort(() => Math.random() - 0.5);
  const selectedProducts: ProductRow[] = [];
  for (let index = 0; index < orderCount; index += 1) {
    selectedProducts.push(shuffled[index % shuffled.length]);
  }

  const orders = selectedProducts.map((product, index) => {
    const dayYmd = days[randomInt(0, days.length - 1)];
    const customerEmail = DEMO_CUSTOMER_EMAILS[index % DEMO_CUSTOMER_EMAILS.length];
    return createSingleProductOrder(product, dayYmd, customerEmail);
  });

  const created = await prisma.$transaction(
    orders.map((order) =>
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

  const addedPence = orders.reduce((sum, order) => sum + order.totalPence, 0);

  console.info(`[shop-sales-bump] Created ${created.length} order(s).`);
  console.info(`[shop-sales-bump] Added revenue: £${(addedPence / 100).toFixed(2)}.`);
  for (const order of orders) {
    const item = order.items[0];
    console.info(
      `  ${order.paidAt.toISOString().slice(0, 10)} · ${item.nameSnapshot} · £${(order.totalPence / 100).toFixed(2)}`
    );
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[shop-sales-bump] Failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
