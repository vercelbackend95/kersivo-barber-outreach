import { EmailOutboundPurpose } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { lockShopCustomerIdentity } from '@/lib/db/customerIdentityLock';
import { buildShopOrderConfirmationEmail } from '@/lib/email/sender';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { formatGbp } from '@/lib/shop/money';
import { captureOpsMessage } from '@/lib/ops/sentry';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';

export type FinalizeRetailOrderInput = {
  orderId: string;
  shopId: string;
  sessionId: string;
  paymentIntentId: string | null;
  amountTotal: number | null;
  customerEmail: string;
  paidAt: Date;
};

export type FinalizeRetailOrderResult =
  | { outcome: 'confirmed'; orderId: string }
  | { outcome: 'duplicate'; orderId: string }
  | { outcome: 'not_found' }
  | { outcome: 'amount_mismatch' }
  | { outcome: 'missing_email' }
  | { outcome: 'invalid' };

/**
 * CAS PENDING_PAYMENT → PAID for a Connect retail checkout, then enqueue confirmation email.
 */
export async function finalizeRetailOrderFromCheckout(
  input: FinalizeRetailOrderInput,
): Promise<FinalizeRetailOrderResult> {
  const orderId = input.orderId.trim();
  const shopId = input.shopId.trim();
  if (!orderId || !shopId || shopId === DEMO_SHOP_ID) {
    return { outcome: 'invalid' };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    select: {
      id: true,
      status: true,
      totalPence: true,
      customerEmail: true,
      reference: true,
      shop: { select: { name: true } },
      items: {
        select: {
          nameSnapshot: true,
          quantity: true,
          lineTotalPence: true,
        },
      },
    },
  });

  if (!order) return { outcome: 'not_found' };
  if (order.status !== 'PENDING_PAYMENT') {
    return { outcome: 'duplicate', orderId };
  }

  if (input.amountTotal !== null && input.amountTotal !== order.totalPence) {
    captureOpsMessage('Retail order amount mismatch', {
      level: 'error',
      route: 'finalizeRetailOrderFromCheckout',
      shopId,
      tags: {
        orderId,
        sessionId: input.sessionId,
      },
    });
    return { outcome: 'amount_mismatch' };
  }

  const sessionEmail = input.customerEmail.trim().toLowerCase();
  const orderEmail = order.customerEmail.trim().toLowerCase();
  let customerEmail =
    sessionEmail && !sessionEmail.endsWith('@checkout.kersivo.local')
      ? sessionEmail
      : orderEmail && !orderEmail.endsWith('@checkout.kersivo.local')
        ? orderEmail
        : '';
  if (!customerEmail) {
    return { outcome: 'missing_email' };
  }

  let outboxId: string | null = null;
  const cas = await prisma.$transaction(async (tx) => {
    // Same identity lock as Order create / Client erasure — serialize finalize vs erase.
    await lockShopCustomerIdentity(tx, shopId, customerEmail);

    const fresh = await tx.order.findFirst({
      where: { id: orderId, shopId },
      select: { customerEmail: true, status: true },
    });
    if (!fresh || fresh.status !== 'PENDING_PAYMENT') {
      return { won: false as const };
    }

    // Do not re-attach a real mailbox after Client erasure anonymised this Order.
    const preservedEmail = fresh.customerEmail.trim();
    const alreadyErased = preservedEmail.toLowerCase().endsWith('@example.invalid');
    const emailToStore = alreadyErased ? preservedEmail : customerEmail;
    customerEmail = emailToStore;

    const updated = await tx.order.updateMany({
      where: { id: orderId, shopId, status: 'PENDING_PAYMENT' },
      data: {
        status: 'PAID',
        paidAt: input.paidAt,
        customerEmail: emailToStore,
        stripeSessionId: input.sessionId,
        stripePaymentIntentId: input.paymentIntentId,
      },
    });

    if (updated.count === 0) {
      return { won: false as const };
    }

    if (alreadyErased) {
      return { won: true as const };
    }

    const rendered = buildShopOrderConfirmationEmail({
      to: customerEmail,
      shopName: order.shop.name,
      reference: order.reference,
      totalFormatted: formatGbp(order.totalPence),
      itemLines: order.items.map(
        (item) => `${item.nameSnapshot} × ${item.quantity} — ${formatGbp(item.lineTotalPence)}`,
      ),
    });
    const outbound = await enqueueEmail(tx, {
      shopId,
      bookingId: null,
      purpose: EmailOutboundPurpose.SHOP_ORDER_CONFIRMATION,
      to: customerEmail,
      subject: rendered.subject,
      html: rendered.html,
    });
    outboxId = outbound.id;
    return { won: true as const };
  });

  if (!cas.won) {
    return { outcome: 'duplicate', orderId };
  }

  await tryDeliverOutboxEmail(outboxId);
  return { outcome: 'confirmed', orderId };
}
