export const prerender = false;

import type { APIRoute } from 'astro';
import { auth } from '@/lib/auth';
import {
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
} from '@/lib/admin/session';
import { prisma } from '@/lib/db/client';
import {
  ACCOUNT_DELETE_BLOCKED_CODE,
  assertAccountDeletionAllowed,
} from '@/lib/setup/accountDeletionGate';
import {
  ACCOUNT_LIFECYCLE_ACTIONS,
  recordAccountLifecycleEvent,
} from '@/lib/setup/accountLifecycleAudit';
import {
  userHasPasswordCredential,
  verifyAccountDeletionReauth,
} from '@/lib/setup/accountReauth';
import { purgeShopData } from '@/lib/setup/purgeShopData';

async function loadSoleOwnerShopIds(userId: string): Promise<string[]> {
  const ownerMemberships = await prisma.shopMember.findMany({
    where: { userId, role: 'OWNER' },
    select: { shopId: true },
  });

  const soleOwnerShopIds: string[] = [];
  for (const membership of ownerMemberships) {
    const otherOwners = await prisma.shopMember.count({
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
  return soleOwnerShopIds;
}

/**
 * Preview whether account deletion is allowed (billing gate + re-auth mode).
 */
export const GET: APIRoute = async (context) => {
  const session = await auth.api.getSession({ headers: context.request.headers });
  if (!session?.user?.id || !session.user.email) {
    return new Response(JSON.stringify({ error: 'Sign in required.' }), { status: 401 });
  }

  const userId = session.user.id;
  const email = session.user.email.trim().toLowerCase();
  const soleOwnerShopIds = await loadSoleOwnerShopIds(userId);

  const subscriptions =
    soleOwnerShopIds.length > 0
      ? await prisma.saasSubscription.findMany({
          where: { shopId: { in: soleOwnerShopIds } },
          select: {
            shopId: true,
            status: true,
            stripeSubscriptionId: true,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: true,
          },
        })
      : [];

  const gate = assertAccountDeletionAllowed(subscriptions);
  const hasPasswordCredential = await userHasPasswordCredential(userId);

  return new Response(
    JSON.stringify({
      hasPasswordCredential,
      deletionBlocked: !gate.allowed,
      blockingShops: gate.allowed ? [] : gate.shops,
      soleOwnerShopIds,
      email,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

/**
 * Permanently delete the signed-in Better Auth user.
 * Sole-OWNER shops are deleted. Blocked while Stripe may still bill.
 */
export const DELETE: APIRoute = async (context) => {
  const session = await auth.api.getSession({ headers: context.request.headers });
  if (!session?.user?.id || !session.user.email) {
    return new Response(JSON.stringify({ error: 'Sign in required.' }), { status: 401 });
  }

  const userId = session.user.id;
  const email = session.user.email.trim().toLowerCase();

  let body: { confirm?: string; password?: string; emailConfirm?: string } = {};
  try {
    const text = await context.request.text();
    if (text.trim()) {
      body = JSON.parse(text) as typeof body;
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 });
  }

  if (body.confirm !== 'DELETE') {
    return new Response(
      JSON.stringify({ error: 'Type DELETE to confirm account deletion.' }),
      { status: 400 },
    );
  }

  const reauth = await verifyAccountDeletionReauth({
    userId,
    email,
    password: body.password,
    emailConfirm: body.emailConfirm,
  });
  if (!reauth.ok) {
    return new Response(JSON.stringify({ error: reauth.error }), { status: reauth.status });
  }

  const soleOwnerShopIds = await loadSoleOwnerShopIds(userId);
  const subscriptions =
    soleOwnerShopIds.length > 0
      ? await prisma.saasSubscription.findMany({
          where: { shopId: { in: soleOwnerShopIds } },
          select: {
            shopId: true,
            status: true,
            stripeSubscriptionId: true,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: true,
          },
        })
      : [];

  const gate = assertAccountDeletionAllowed(subscriptions);
  if (!gate.allowed) {
    await recordAccountLifecycleEvent({
      action: ACCOUNT_LIFECYCLE_ACTIONS.ACCOUNT_DELETE_BLOCKED,
      userId,
      email,
      shopId: gate.shops[0]?.shopId ?? null,
      meta: { shops: gate.shops },
    });
    return new Response(
      JSON.stringify({
        error:
          'Cancel your KERSIVO subscription first. Account deletion is blocked while billing is active, past due, or suspended.',
        code: ACCOUNT_DELETE_BLOCKED_CODE,
        shops: gate.shops,
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  }

  await recordAccountLifecycleEvent({
    action: ACCOUNT_LIFECYCLE_ACTIONS.ACCOUNT_DELETED,
    userId,
    email,
    shopId: soleOwnerShopIds[0] ?? null,
    meta: { soleOwnerShopIds },
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.barber.updateMany({
        where: { userId },
        data: { userId: null },
      });

      for (const shopId of soleOwnerShopIds) {
        await purgeShopData(tx, shopId);
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
