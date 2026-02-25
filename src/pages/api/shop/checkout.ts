export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/db/client';
import { resolveShopId } from '../../../lib/db/shopScope';
import { createCheckoutSession } from '../../../lib/shop/stripe';


type CheckoutInput = {
  email: string;
  items: Array<{ productId: string; quantity: number }>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPublicSiteUrl() {
  const configured = (import.meta.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321').trim();
  return configured.replace(/\/$/, '');
}


export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as CheckoutInput;
    const email = body.email?.trim().toLowerCase();

    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(JSON.stringify({ error: 'Valid email is required.' }), { status: 400 });

    }

    const requestedItems = (body.items ?? [])
      .map((item) => ({
        productId: String(item.productId ?? '').trim(),
        quantity: Math.floor(Number(item.quantity ?? 0))
      }))
      .filter((item) => item.productId && item.quantity >= 1);


    if (requestedItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart is empty.' }), { status: 400 });
    }

    const quantityByProduct = new Map<string, number>();
    for (const item of requestedItems) {
      quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    const shopId = await resolveShopId();
    const products = await prisma.product.findMany({
      where: {
        shopId,
        id: { in: [...quantityByProduct.keys()] },
        active: true
      },
      select: {
        id: true,
        name: true,
        pricePence: true,
        imageUrl: true
      }

    });

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
        imageUrl: product.imageUrl ?? ''
      };
    });

    const baseUrl = getPublicSiteUrl();
    const session = await createCheckoutSession({
      customerEmail: email,
      successUrl: `${baseUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/shop/cancelled`,
      lineItems: snapshot.map((item) => ({
        productId: item.productId,
        name: item.nameSnapshot,
        unitAmount: item.unitPricePenceSnapshot,
        quantity: item.quantity,
        imageUrl: item.imageUrl || undefined
      })),
      metadata: {

        shopId,
        email,
        cart: JSON.stringify(
          snapshot.map((item) => ({
            productId: item.productId,
            name: item.nameSnapshot,
            unitPricePence: item.unitPricePenceSnapshot,
            quantity: item.quantity,
            lineTotalPence: item.lineTotalPence
          }))
        )
      }


    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (error) {
    console.error('Checkout session creation failed', error);
    return new Response(JSON.stringify({ error: 'Unable to create checkout session.' }), { status: 500 });

  }
};
