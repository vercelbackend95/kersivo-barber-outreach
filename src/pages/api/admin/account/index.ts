export const prerender = false;

import type { APIRoute } from 'astro';
import { auth } from '@/lib/auth';
import {
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
} from '@/lib/admin/session';
import { prisma } from '@/lib/db/client';

/**
 * Permanently delete the signed-in Better Auth user.
 * Sole-OWNER shops are deleted (preview cleanup). Invites for the email are reopened
 * so the same team invite link can be accepted again after re-signup.
 */
export const DELETE: APIRoute = async (context) => {
  const session = await auth.api.getSession({ headers: context.request.headers });
  if (!session?.user?.id || !session.user.email) {
    return new Response(JSON.stringify({ error: 'Sign in required.' }), { status: 401 });
  }

  const userId = session.user.id;
  const email = session.user.email.trim().toLowerCase();

  try {
    await prisma.$transaction(async (tx) => {
      const ownerMemberships = await tx.shopMember.findMany({
        where: { userId, role: 'OWNER' },
        select: { shopId: true },
      });

      const soleOwnerShopIds: string[] = [];
      for (const membership of ownerMemberships) {
        const otherOwners = await tx.shopMember.count({
          where: {
            shopId: membership.shopId,
            role: 'OWNER',
            userId: { not: userId },
          },
        });
        if (otherOwners === 0) {
          soleOwnerShopIds.push(membership.shopId);
        }
      }

      await tx.barber.updateMany({
        where: { userId },
        data: { userId: null },
      });

      for (const shopId of soleOwnerShopIds) {
        // Booking has no cascade from Service/Barber — delete first.
        await tx.booking.deleteMany({
          where: {
            OR: [{ barber: { shopId } }, { service: { shopId } }],
          },
        });
        // OrderItem → Product is Restrict; clear orders before shop cascade deletes products.
        await tx.order.deleteMany({ where: { shopId } });
        await tx.shopSettings.delete({ where: { id: shopId } });
      }

      await tx.shopInvite.updateMany({
        where: { email },
        data: { acceptedAt: null },
      });

      await tx.user.delete({ where: { id: userId } });
    });
  } catch (error) {
    console.error('Failed to delete account', error);
    return new Response(JSON.stringify({ error: 'Unable to delete account.' }), { status: 500 });
  }

  context.cookies.set(getAdminSessionCookieName(), '', {
    ...getAdminSessionCookieOptions(import.meta.env.PROD),
    maxAge: 0,
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
