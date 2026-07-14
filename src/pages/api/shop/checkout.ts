export const prerender = false;

import type { APIRoute } from 'astro';
import { resolveAdminAccess } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';
import { DEMO_SHOP_ID } from '../../../lib/db/shopScope';
import { getDemoCatalogProductById } from '../../../lib/shop/demoCatalog';
import { createCheckoutSession } from '../../../lib/shop/stripe';

type CheckoutInput = {
  items: Array<{ productId: string; quantity: number }>;
};

type CheckoutProduct = {
  id: string;
  name: string;
  pricePence: number;
  imageUrl: string | null;
  active: boolean;
};

function getPublicSiteUrl() {
  const configured = (import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321').trim();
  return configured.replace(/\/$/, '');
}

export const POST: APIRoute = async (ctx) => {
  try {
    const body = (await ctx.request.json()) as CheckoutInput;

    const requestedItems = (body.items ?? [])
      .map((item) => ({
        productId: String(item.productId ?? '').trim(),
        quantity: Math.floor(Number(item.quantity ?? 0)),
      }))
      .filter((item) => item.productId && item.quantity >= 1);

    if (requestedItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart is empty.' }), { status: 400 });
    }

    const quantityByProduct = new Map<string, number>();
    for (const item of requestedItems) {
      quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    const productIds = [...quantityByProduct.keys()];
    const access = await resolveAdminAccess(ctx);

    let shopId = DEMO_SHOP_ID;
    let products: CheckoutProduct[] = [];

    if (access?.via === 'session') {
      shopId = access.shopId;
      const rows = await prisma.product.findMany({
        where: {
          shopId: access.shopId,
          id: { in: productIds },
          active: true,
        },
        select: {
          id: true,
          name: true,
          pricePence: true,
          imageUrl: true,
          active: true,
        },
      });
      products = rows;
    } else {
      products = productIds
        .map((productId) => getDemoCatalogProductById(productId))
        .filter((product): product is NonNullable<typeof product> => Boolean(product?.active))
        .map((product) => ({
          id: product.id,
          name: product.name,
          pricePence: product.pricePence,
          imageUrl: product.imageUrl,
          active: product.active,
        }));
    }

    if (products.length !== quantityByProduct.size) {
      return new Response(JSON.stringify({ error: 'Some products are unavailable.' }), { status: 400 });
    }

    const snapshot = products.map((product) => {
      const quantity = quantityByProduct.get(product.id) ?? 0;
      return {
        productId: product.id,
        nameSnapshot: product.name,
        unitPricePenceSnapshot: product.pricePence,
        quantity,
        lineTotalPence: product.pricePence * quantity,
        imageUrl: product.imageUrl ?? '',
      };
    });

    const baseUrl = getPublicSiteUrl();
    const session = await createCheckoutSession({
      successUrl: `${baseUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/shop/cancelled`,
      lineItems: snapshot.map((item) => ({
        productId: item.productId,
        name: item.nameSnapshot,
        unitAmount: item.unitPricePenceSnapshot,
        quantity: item.quantity,
        imageUrl: item.imageUrl || undefined,
      })),
      metadata: {
        shopId,
        cart: JSON.stringify(
          snapshot.map((item) => ({
            productId: item.productId,
            name: item.nameSnapshot,
            unitPricePence: item.unitPricePenceSnapshot,
            quantity: item.quantity,
            lineTotalPence: item.lineTotalPence,
          })),
        ),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (error) {
    console.error('Checkout session creation failed', error);
    return new Response(JSON.stringify({ error: 'Unable to create checkout session.' }), { status: 500 });
  }
};
