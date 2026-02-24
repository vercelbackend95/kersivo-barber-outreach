export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/db/client';
import { resolveShopId } from '../../../lib/db/shopScope';
import { createCheckoutSession } from '../../../lib/shop/stripe';

type CheckoutInput = {
  items: Array<{ productId: string; quantity: number }>;
  customerEmail: string;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as CheckoutInput;
    const customerEmail = body.customerEmail?.trim().toLowerCase();
    if (!customerEmail || !customerEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid customer email is required.' }), { status: 400 });
    }

    const requestedItems = (body.items ?? [])
      .map((item) => ({ productId: item.productId, quantity: Math.max(0, Math.floor(item.quantity ?? 0)) }))
      .filter((item) => item.productId && item.quantity > 0);

    if (requestedItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart is empty.' }), { status: 400 });
    }

    const quantityByProduct = new Map<string, number>();
    for (const item of requestedItems) {
      quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    const shopId = await resolveShopId();
    const products = await prisma.product.findMany({
      where: { shopId, id: { in: [...quantityByProduct.keys()] }, active: true }
    });

    if (products.length !== quantityByProduct.size) {
      return new Response(JSON.stringify({ error: 'Some products are unavailable.' }), { status: 400 });
    }

    const snapshot = products.map((product) => {
      const quantity = quantityByProduct.get(product.id) ?? 0;
      return {
        productId: product.id,
        name: product.name,
        unitPricePence: product.pricePence,
        quantity,
        lineTotalPence: product.pricePence * quantity
      };
    });

    const totalPence = snapshot.reduce((sum, item) => sum + item.lineTotalPence, 0);
    const publicSiteUrl = import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL;
    if (!publicSiteUrl) {
      return new Response(JSON.stringify({ error: 'PUBLIC_SITE_URL is not configured.' }), { status: 500 });
    }

    const session = await createCheckoutSession({
      customerEmail,
      successUrl: `${publicSiteUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${publicSiteUrl}/shop/cancelled`,
      lineItems: snapshot.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitAmount: item.unitPricePence
      })),
      metadata: {
        shopId,
        customerEmail,
        currency: 'gbp',
        totalPence: String(totalPence),
        cart: JSON.stringify(snapshot)
      }
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (error) {
    console.error('Checkout error', error);
    return new Response(JSON.stringify({ error: 'Unable to start checkout.' }), { status: 500 });
  }
};
