export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import {
  assertShopAcceptingPublicActivity,
  ShopPublicActivityPausedError,
} from '@/lib/admin/shopPublicActivity';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import { shopAcceptsPublicBookings } from '@/lib/setup/shopPublicBookingGate';
import {
  canSellRetail,
  evaluateRetailSelling,
} from '@/lib/shop/cardPaymentsGate';
import { createRetailCheckoutSession } from '@/lib/shop/stripeConnect';
import { generateOrderReference } from '@/lib/shop/orderReference';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';

type CheckoutInput = {
  items?: Array<{ productId?: unknown; quantity?: unknown }>;
  customerEmail?: unknown;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getPublicSiteUrl() {
  const configured = (
    import.meta.env.PUBLIC_SITE_URL ??
    process.env.PUBLIC_SITE_URL ??
    'http://localhost:4321'
  )
    .toString()
    .trim();
  return configured.replace(/\/$/, '');
}

function retailUnavailableMessage(reason: ReturnType<typeof evaluateRetailSelling>['reason']): string {
  switch (reason) {
    case 'retail_disabled':
      return 'Online retail is not enabled for this shop.';
    case 'connect_missing':
    case 'connect_not_ready':
      return 'Card payments are not ready for this shop yet.';
    case 'unpaid_shop':
      return 'Online retail is not available for this shop.';
    case 'demo_shop':
      return 'Demo shop cannot accept live retail payments.';
    default:
      return 'Online retail is not available for this shop.';
  }
}

export const POST: APIRoute = async (ctx) => {
  try {
    const limited = await enforceIpRateLimit(ctx.request, 'shop_checkout', 10, 15 * 60 * 1000);
    if (limited) return limited;

    const shopId = ctx.params.shopId?.trim() ?? '';
    if (!shopId || shopId === DEMO_SHOP_ID) {
      return json({ error: 'Shop not found.' }, 404);
    }

    const shop = await prisma.shopSettings.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        shopPaidAt: true,
        smsRemindersEnabled: true,
        retailEnabled: true,
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
      },
    });
    if (!shop) {
      return json({ error: 'Shop not found.' }, 404);
    }

    const acceptsPublic = await shopAcceptsPublicBookings(shopId);
    if (!acceptsPublic) {
      return json({ error: 'Online retail is not available for this shop.' }, 403);
    }

    try {
      await assertShopAcceptingPublicActivity(shopId);
    } catch (error) {
      if (error instanceof ShopPublicActivityPausedError) {
        return json({ error: error.message, code: error.code }, error.status);
      }
      throw error;
    }

    const retailGate = evaluateRetailSelling(shop);
    if (!retailGate.ok || !canSellRetail(shop)) {
      return json({ error: retailUnavailableMessage(retailGate.reason), reason: retailGate.reason }, 503);
    }

    const connectAccountId = shop.stripeConnectAccountId!.trim();

    const body = (await ctx.request.json().catch(() => null)) as CheckoutInput | null;
    const requestedItems = (body?.items ?? [])
      .map((item) => ({
        productId: String(item.productId ?? '').trim(),
        quantity: Math.floor(Number(item.quantity ?? 0)),
      }))
      .filter((item) => item.productId && item.quantity >= 1);

    if (requestedItems.length === 0) {
      return json({ error: 'Cart is empty.' }, 400);
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
      select: { id: true, name: true, pricePence: true, imageUrl: true },
    });

    if (products.length !== quantityByProduct.size) {
      return json({ error: 'Some products are unavailable.' }, 400);
    }

    const snapshot = products.map((product) => {
      const quantity = quantityByProduct.get(product.id) ?? 0;
      return {
        productId: product.id,
        name: product.name,
        unitPricePence: product.pricePence,
        quantity,
        lineTotalPence: product.pricePence * quantity,
        imageUrl: product.imageUrl ?? '',
      };
    });
    const totalPence = snapshot.reduce((sum, item) => sum + item.lineTotalPence, 0);
    if (totalPence <= 0) {
      return json({ error: 'Cart total must be greater than zero.' }, 400);
    }

    const rawEmail = typeof body?.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : '';
    const customerEmail = rawEmail && rawEmail.includes('@') ? rawEmail : 'pending@checkout.kersivo.local';

    let order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          shopId,
          customerEmail,
          status: 'PENDING_PAYMENT',
          currency: 'gbp',
          totalPence,
          reference: generateOrderReference(),
          stripeConnectAccountId: connectAccountId,
          isTestOrder: false,
          paidAt: null,
          items: {
            create: snapshot.map((item) => ({
              productId: item.productId,
              nameSnapshot: item.name,
              unitPricePenceSnapshot: item.unitPricePence,
              quantity: item.quantity,
              lineTotalPence: item.lineTotalPence,
            })),
          },
        },
        select: { id: true, createdAt: true, reference: true },
      });
      return created;
    });

    // Extremely unlikely unique collision on reference — retry once.
    if (!order.reference) {
      order = await prisma.order.update({
        where: { id: order.id },
        data: { reference: generateOrderReference(Date.now() + 1) },
        select: { id: true, createdAt: true, reference: true },
      });
    }

    const baseUrl = getPublicSiteUrl();
    const session = await createRetailCheckoutSession({
      shopConnectAccountId: connectAccountId,
      orderId: order.id,
      shopId,
      customerEmail: customerEmail.endsWith('@checkout.kersivo.local') ? undefined : customerEmail,
      orderCreatedAt: order.createdAt,
      successUrl: `${baseUrl}/shop/${shopId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/shop/${shopId}?checkout=cancelled`,
      lineItems: snapshot.map((item) => ({
        name: item.name,
        unitAmountPence: item.unitPricePence,
        quantity: item.quantity,
        imageUrl: item.imageUrl || undefined,
      })),
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return json({ url: session.url, orderId: order.id, reference: order.reference });
  } catch (error) {
    console.error('Public retail checkout failed', error);
    return json({ error: 'Unable to create checkout session.' }, 500);
  }
};
