export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminContext } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';
import { formatGbp } from '../../../../lib/shop/money';

type TestOrderInput = {
  items?: Array<{ productId?: string; quantity?: number }>;
  idempotencyKey?: string;
};

function serializeOrder(order: {
  id: string;
  status: string;
  totalPence: number;
  isTestOrder: boolean;
  paidAt: Date | null;
  customerEmail: string;
  items: Array<{
    productId: string;
    nameSnapshot: string;
    unitPricePenceSnapshot: number;
    quantity: number;
    lineTotalPence: number;
  }>;
}) {
  return {
    id: order.id,
    status: order.status,
    totalPence: order.totalPence,
    totalFormatted: formatGbp(order.totalPence),
    isTestOrder: order.isTestOrder,
    paidAt: order.paidAt?.toISOString() ?? null,
    customerEmail: order.customerEmail,
    items: order.items.map((item) => ({
      productId: item.productId,
      name: item.nameSnapshot,
      unitPricePence: item.unitPricePenceSnapshot,
      quantity: item.quantity,
      lineTotalPence: item.lineTotalPence,
      lineTotalFormatted: formatGbp(item.lineTotalPence),
    })),
  };
}

/**
 * Private retail onboarding / test-shop: create a real Order without Stripe.
 * Session owners only — never available for public storefront or secret/demo access.
 */
export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  if (access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Test orders require an authenticated shop owner.' }), {
      status: 403,
    });
  }

  const shopId = access.shopId;
  const customerEmail = access.userEmail?.trim().toLowerCase();
  if (!customerEmail) {
    return new Response(JSON.stringify({ error: 'Account email is required to place a test order.' }), {
      status: 400,
    });
  }

  let body: TestOrderInput = {};
  try {
    body = (await ctx.request.json()) as TestOrderInput;
  } catch {
    body = {};
  }

  const idempotencyKey =
    (typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()) ||
    ctx.request.headers.get('Idempotency-Key')?.trim() ||
    null;

  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      retailTestOrderId: true,
      retailTestOrderCompletedAt: true,
      retailPickupWalkthroughCompletedAt: true,
    },
  });

  if (!shop) {
    return new Response(JSON.stringify({ error: 'Shop not found.' }), { status: 404 });
  }

  if (shop.retailTestOrderId) {
    const existing = await prisma.order.findFirst({
      where: { id: shop.retailTestOrderId, shopId, isTestOrder: true },
      include: {
        items: {
          select: {
            productId: true,
            nameSnapshot: true,
            unitPricePenceSnapshot: true,
            quantity: true,
            lineTotalPence: true,
          },
        },
      },
    });

    if (existing) {
      return new Response(
        JSON.stringify({
          ok: true,
          resumed: true,
          order: serializeOrder(existing),
        }),
        { status: 200 },
      );
    }
  }

  const requestedItems = (body.items ?? [])
    .map((item) => ({
      productId: String(item.productId ?? '').trim(),
      quantity: Math.floor(Number(item.quantity ?? 0)),
    }))
    .filter((item) => item.productId && item.quantity >= 1);

  if (requestedItems.length === 0) {
    return new Response(JSON.stringify({ error: 'Your bag is empty. Add products before placing a test order.' }), {
      status: 400,
    });
  }

  const quantityByProduct = new Map<string, number>();
  for (const item of requestedItems) {
    quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
  }
  const productIds = [...quantityByProduct.keys()];

  const products = await prisma.product.findMany({
    where: {
      shopId,
      id: { in: productIds },
      active: true,
    },
    select: {
      id: true,
      name: true,
      pricePence: true,
    },
  });

  if (products.length !== quantityByProduct.size) {
    return new Response(JSON.stringify({ error: 'Some products are unavailable in your shop.' }), {
      status: 400,
    });
  }

  const cart = products.map((product) => {
    const quantity = quantityByProduct.get(product.id) ?? 0;
    return {
      productId: product.id,
      name: product.name,
      unitPricePence: product.pricePence,
      quantity,
      lineTotalPence: product.pricePence * quantity,
    };
  });
  const totalPence = cart.reduce((sum, item) => sum + item.lineTotalPence, 0);

  // Serialize create + shop flag update to reduce double-submit races.
  const created = await prisma.$transaction(async (tx) => {
    const fresh = await tx.shopSettings.findUnique({
      where: { id: shopId },
      select: { retailTestOrderId: true },
    });

    if (fresh?.retailTestOrderId) {
      const existing = await tx.order.findFirst({
        where: { id: fresh.retailTestOrderId, shopId, isTestOrder: true },
        include: {
          items: {
            select: {
              productId: true,
              nameSnapshot: true,
              unitPricePenceSnapshot: true,
              quantity: true,
              lineTotalPence: true,
            },
          },
        },
      });
      if (existing) {
        return { resumed: true as const, order: existing };
      }
    }

    // Create via nested write inside the same transaction (mirror helper shape).
    const order = await tx.order.create({
      data: {
        shopId,
        customerEmail,
        status: 'PAID',
        currency: 'gbp',
        totalPence,
        stripeSessionId: null,
        isTestOrder: true,
        paidAt: new Date(),
        items: {
          create: cart.map((item) => ({
            productId: item.productId,
            nameSnapshot: item.name,
            unitPricePenceSnapshot: item.unitPricePence,
            quantity: item.quantity,
            lineTotalPence: item.lineTotalPence,
          })),
        },
      },
      include: {
        items: {
          select: {
            productId: true,
            nameSnapshot: true,
            unitPricePenceSnapshot: true,
            quantity: true,
            lineTotalPence: true,
          },
        },
      },
    });

    await tx.shopSettings.update({
      where: { id: shopId },
      data: {
        retailTestOrderId: order.id,
        retailTestOrderCompletedAt: new Date(),
      },
    });

    // Optional: stash last idempotency key in memory is not durable; shop flag is enough.
    void idempotencyKey;

    return { resumed: false as const, order };
  });

  return new Response(
    JSON.stringify({
      ok: true,
      resumed: created.resumed,
      order: serializeOrder(created.order),
    }),
    { status: created.resumed ? 200 : 201 },
  );
};
