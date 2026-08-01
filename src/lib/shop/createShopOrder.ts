import { EmailOutboundPurpose } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { formatGbp } from '@/lib/shop/money';
import { buildShopOrderConfirmationEmail } from '@/lib/email/sender';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';

export type ShopOrderCartItem = {
  productId: string;
  name: string;
  unitPricePence: number;
  quantity: number;
  lineTotalPence: number;
};

export type CreateShopOrderInput = {
  shopId: string;
  customerEmail: string;
  cart: ShopOrderCartItem[];
  totalPence: number;
  isTestOrder?: boolean;
  stripeSessionId?: string | null;
  sendEmail?: boolean;
  paidAt?: Date;
};

export type CreatedShopOrder = {
  id: string;
  shopId: string;
  customerEmail: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'READY_FOR_PICKUP' | 'COLLECTED';
  totalPence: number;
  isTestOrder: boolean;
  paidAt: Date | null;
  items: Array<{
    productId: string;
    nameSnapshot: string;
    unitPricePenceSnapshot: number;
    quantity: number;
    lineTotalPence: number;
  }>;
};

/**
 * Shared shop order creation used by Stripe webhook and private test-order API.
 * Confirmation email is enqueued atomically with the order; delivery is best-effort
 * after commit so Resend failures never fail a paid webhook.
 */
export async function createShopOrder(input: CreateShopOrderInput): Promise<CreatedShopOrder> {
  const customerEmail = input.customerEmail.trim().toLowerCase();
  if (!customerEmail) {
    throw new Error('Customer email is required.');
  }
  if (!input.cart.length) {
    throw new Error('Cart is empty.');
  }

  const paidAt = input.paidAt ?? new Date();
  const isTestOrder = Boolean(input.isTestOrder);
  const shouldEnqueueEmail = input.sendEmail !== false && !isTestOrder;
  let outboxId: string | null = null;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        shopId: input.shopId,
        customerEmail,
        status: 'PAID',
        currency: 'gbp',
        totalPence: input.totalPence,
        stripeSessionId: input.stripeSessionId ?? null,
        isTestOrder,
        paidAt,
        items: {
          create: input.cart.map((item) => ({
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

    if (shouldEnqueueEmail) {
      const rendered = buildShopOrderConfirmationEmail({
        to: customerEmail,
        totalFormatted: formatGbp(input.totalPence),
        itemLines: input.cart.map(
          (item) => `${item.name} × ${item.quantity} — ${formatGbp(item.lineTotalPence)}`,
        ),
      });
      const outbound = await enqueueEmail(tx, {
        shopId: input.shopId,
        bookingId: null,
        purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
        to: customerEmail,
        subject: rendered.subject,
        html: rendered.html,
      });
      outboxId = outbound.id;
    }

    return created;
  });

  await tryDeliverOutboxEmail(outboxId);

  return {
    id: order.id,
    shopId: order.shopId,
    customerEmail: order.customerEmail,
    status: order.status,
    totalPence: order.totalPence,
    isTestOrder: order.isTestOrder,
    paidAt: order.paidAt,
    items: order.items,
  };
}
