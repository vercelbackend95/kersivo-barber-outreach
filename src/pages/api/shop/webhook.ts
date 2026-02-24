export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/db/client';
import { sendShopOrderConfirmationEmail } from '../../../lib/email/sender';
import { formatGbp } from '../../../lib/shop/money';
import { retrieveCheckoutSession, verifyStripeWebhookSignature } from '../../../lib/shop/stripe';

type CartSnapshotItem = {
  productId: string;
  name: string;
  unitPricePence: number;
  quantity: number;
  lineTotalPence: number;
};

type StripeEvent = {
  type: string;
  data: {
    object: {
      id: string;
      metadata?: Record<string, string>;
      customer_email?: string | null;
      amount_total?: number | null;
      currency?: string | null;
    };
  };
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');
    if (!signature || !verifyStripeWebhookSignature(rawBody, signature)) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
    }

    const event = JSON.parse(rawBody) as StripeEvent;
    if (event.type !== 'checkout.session.completed') {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const sessionId = event.data.object.id;
    const existing = await prisma.order.findUnique({ where: { stripeSessionId: sessionId }, select: { id: true } });
    if (existing) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
    }

    const session = await retrieveCheckoutSession(sessionId);
    const metadata = session.metadata ?? event.data.object.metadata ?? {};
    const customerEmail = (session.metadata?.customerEmail ?? event.data.object.customer_email ?? '').toLowerCase();
    const shopId = metadata.shopId;

    if (!shopId || !customerEmail) {
      return new Response(JSON.stringify({ error: 'Missing metadata' }), { status: 400 });
    }

    const cart = JSON.parse(metadata.cart ?? '[]') as CartSnapshotItem[];
    if (!Array.isArray(cart) || cart.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing cart metadata' }), { status: 400 });
    }

    const totalPence = typeof session.amount_total === 'number'
      ? session.amount_total
      : cart.reduce((sum, item) => sum + item.lineTotalPence, 0);

    await prisma.order.create({
      data: {
        shopId,
        customerEmail,
        status: 'PAID',
        currency: 'gbp',
        totalPence,
        stripeSessionId: sessionId,
        paidAt: new Date(),
        items: {
          create: cart.map((item) => ({
            productId: item.productId,
            nameSnapshot: item.name,
            unitPricePenceSnapshot: item.unitPricePence,
            quantity: item.quantity,
            lineTotalPence: item.lineTotalPence
          }))
        }
      }
    });

    await sendShopOrderConfirmationEmail({
      to: customerEmail,
      totalFormatted: formatGbp(totalPence),
      itemLines: cart.map((item) => `${item.name} × ${item.quantity} — ${formatGbp(item.lineTotalPence)}`)
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error('Stripe webhook failed', error);
    return new Response(JSON.stringify({ error: 'Webhook handling failed' }), { status: 500 });
  }
};
