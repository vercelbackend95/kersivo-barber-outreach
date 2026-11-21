import { EmailOutboundPurpose, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { lockShopCustomerIdentity } from '@/lib/db/customerIdentityLock';
import { buildShopReservationConfirmationEmail } from '@/lib/email/sender';
import { enqueueEmail, tryDeliverOutboxEmail } from '@/lib/email/outbox';
import { formatGbp } from '@/lib/shop/money';
import { generateOrderReference } from '@/lib/shop/orderReference';
import type { ReservationContact } from '@/lib/shop/retailPaymentMode';

export type RetailReservationCartItem = {
  productId: string;
  name: string;
  unitPricePence: number;
  quantity: number;
  lineTotalPence: number;
};

export type CreateRetailReservationInput = {
  shopId: string;
  shopName: string;
  contact: ReservationContact;
  cart: RetailReservationCartItem[];
  totalPence: number;
};

export type CreatedRetailReservation = {
  id: string;
  reference: string;
  customerEmail: string;
  totalPence: number;
};

const REFERENCE_ATTEMPTS = 3;

function isReferenceCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  return Array.isArray(target) ? target.includes('reference') : String(target ?? '').includes('reference');
}

/**
 * Pay-at-collection order: created RESERVED_UNPAID without Stripe (no Connect account, no paidAt),
 * with the client's contact details and a pickup reference. The reservation email is enqueued in the
 * same transaction (SHOP_ORDER_CONFIRMATION purpose, so Client erasure clears it like paid ones) and
 * delivered best-effort after commit.
 */
export async function createRetailReservation(
  input: CreateRetailReservationInput,
): Promise<CreatedRetailReservation> {
  if (!input.cart.length) throw new Error('Cart is empty.');
  const { customerEmail, customerName, customerPhone } = input.contact;

  for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt += 1) {
    const reference = generateOrderReference(Date.now() + attempt);
    let outboxId: string | null = null;
    try {
      const order = await prisma.$transaction(async (tx) => {
        await lockShopCustomerIdentity(tx, input.shopId, customerEmail);
        const created = await tx.order.create({
          data: {
            shopId: input.shopId,
            customerEmail,
            customerName,
            customerPhone,
            status: 'RESERVED_UNPAID',
            currency: 'gbp',
            totalPence: input.totalPence,
            reference,
            isTestOrder: false,
            paidAt: null,
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
          select: { id: true, reference: true, customerEmail: true, totalPence: true },
        });

        const rendered = buildShopReservationConfirmationEmail({
          to: customerEmail,
          customerName,
          shopName: input.shopName,
          reference: created.reference,
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
        return created;
      });

      await tryDeliverOutboxEmail(outboxId);
      return {
        id: order.id,
        reference: order.reference ?? reference,
        customerEmail: order.customerEmail,
        totalPence: order.totalPence,
      };
    } catch (error) {
      if (isReferenceCollision(error) && attempt < REFERENCE_ATTEMPTS - 1) continue;
      throw error;
    }
  }
  throw new Error('Could not allocate a pickup reference.');
}
