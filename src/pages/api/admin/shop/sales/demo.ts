export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';

const LEGACY_DEMO_EMAIL_PREFIX = 'demo+shop-sales-';
const DEMO_EMAIL_TAG = '+demo-';
const MIN_TARGET_ORDERS = 15;
const MAX_TARGET_ORDERS = 40;
const MAX_DEMO_ORDERS_IN_WINDOW = 60;
const WINDOW_DAYS = 30;

const DEMO_CUSTOMER_EMAILS = [
  'oliver.reed@example.com',
  'amelia.clarke@example.com',
  'noah.bennett@example.com',
  'isla.morgan@example.com',
  'leo.carter@example.com',
  'maya.brooks@example.com',
  'theo.hughes@example.com',
  'grace.turner@example.com',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'retail.manage');
  if (access instanceof Response) return access;

  if (!import.meta.env.DEV) {
    return new Response(JSON.stringify({ error: 'Demo data generation is available only in DEV.' }), { status: 403 });
  }

  try {
    const shopId = access.shopId;
    const products = await prisma.product.findMany({
      where: { shopId, active: true },
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, name: true, pricePence: true }
    });

    if (products.length === 0) {
      return new Response(JSON.stringify({ error: 'Add products first' }), { status: 400 });
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const existingDemoOrders = await prisma.order.count({
      where: {
        shopId,
        OR: [
          { customerEmail: { startsWith: LEGACY_DEMO_EMAIL_PREFIX } },
          { customerEmail: { contains: DEMO_EMAIL_TAG } },
          { customerEmail: { in: DEMO_CUSTOMER_EMAILS } }
        ],
        createdAt: { gte: windowStart }
      }
    });

    const targetOrders = randomInt(MIN_TARGET_ORDERS, MAX_TARGET_ORDERS);
    const roomLeft = Math.max(0, MAX_DEMO_ORDERS_IN_WINDOW - existingDemoOrders);
    const toCreate = Math.max(0, Math.min(targetOrders, roomLeft));

    if (toCreate === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          created: 0,
          message: 'Demo sales data already populated for this period.'
        }),
        { status: 200 }
      );
    }

    await prisma.$transaction(
      Array.from({ length: toCreate }).map((_, index) => {
        const paidAt = new Date(now);
        paidAt.setUTCDate(paidAt.getUTCDate() - randomInt(0, WINDOW_DAYS - 1));
        paidAt.setUTCHours(randomInt(9, 19), randomInt(0, 5) * 10, 0, 0);

        const lineCount = randomInt(1, Math.min(3, products.length));
        const shuffledProducts = [...products].sort(() => Math.random() - 0.5);
        const selectedProducts = shuffledProducts.slice(0, lineCount);

        const items = selectedProducts.map((product) => {
          const quantity = randomInt(1, 3);
          const lineTotalPence = product.pricePence * quantity;

          return {
            productId: product.id,
            nameSnapshot: product.name,
            unitPricePenceSnapshot: product.pricePence,
            quantity,
            lineTotalPence
          };
        });

        const totalPence = items.reduce((sum, item) => sum + item.lineTotalPence, 0);
        const customerEmail = DEMO_CUSTOMER_EMAILS[index % DEMO_CUSTOMER_EMAILS.length];

        return prisma.order.create({
          data: {
            shopId,
            customerEmail,
            status: 'PAID',
            currency: 'gbp',
            totalPence,
            paidAt,
            createdAt: paidAt,
            items: {
              create: items
            }
          }
        });
      })
    );

    return new Response(
      JSON.stringify({
        ok: true,
        created: toCreate,
        message: `Generated ${toCreate} demo orders.`
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to generate demo sales data', error);
    const details = error instanceof Error && error.stack ? error.stack : undefined;
    return new Response(JSON.stringify({ error: 'Could not generate demo sales data.', details }), { status: 500 });
  }
};
