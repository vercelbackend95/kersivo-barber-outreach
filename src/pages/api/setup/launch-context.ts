export const prerender = false;

import type { APIRoute } from 'astro';
import { SetupDepositStatus, SetupPlan } from '@prisma/client';
import { resolveAdminAccess } from '../../../lib/admin/auth';
import { requirePermission } from '../../../lib/admin/rbac/can';
import {
  buildLaunchProgress,
  resolveLaunchBillingFlags,
} from '../../../lib/admin/launchCtaProgress';
import { prisma } from '../../../lib/db/client';
import { getSetupOnboardingFormUrlOrEmpty } from '../../../lib/email/sender';
import { isPaidShop } from '../../../lib/shop/paidShop';
import type { SetupPlanId } from '../../../lib/setup/plans';

function setupPlanToId(plan: SetupPlan): SetupPlanId {
  return plan === SetupPlan.PRIORITY ? 'priority' : 'launch';
}

type LaunchPending = {
  plan: SetupPlanId;
  shopSize: string;
  currentStack: string;
};

/**
 * Context for Launch Wizard + sidebar launch CTA progress checklist.
 */
export const GET: APIRoute = async (context) => {
  const access = await resolveAdminAccess(context);
  if (!access || access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const denied = requirePermission(access, 'billing.manage');
  if (denied) return denied;

  const shop = await prisma.shopSettings.findUnique({
    where: { id: access.shopId },
    select: {
      id: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      onboardingCompleted: true,
      retailOnboardingSkipped: true,
      retailPickupWalkthroughCompletedAt: true,
      name: true,
      townCity: true,
      barbers: {
        where: { active: true },
        select: { id: true, name: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      },
      _count: {
        select: {
          services: true,
        },
      },
    },
  });

  if (!shop) {
    return new Response(JSON.stringify({ error: 'Shop not found.' }), { status: 404 });
  }

  const shopPaid = isPaidShop(shop);

  const shopPayload = {
    name: shop.name,
    townCity: shop.townCity?.trim() || null,
    barbers: shop.barbers.map((barber) => ({ id: barber.id, name: barber.name })),
  };

  const userPayload = {
    name: access.userName,
    email: access.userEmail,
  };

  const [members, invites, allBarbers] = await Promise.all([
    prisma.shopMember.findMany({
      where: { shopId: access.shopId },
      select: { id: true, barberId: true },
    }),
    prisma.shopInvite.findMany({
      where: { shopId: access.shopId, acceptedAt: null },
      select: { barberId: true },
    }),
    prisma.barber.findMany({
      where: { shopId: access.shopId },
      select: { id: true, userId: true },
    }),
  ]);

  // Match Team roster profile cards: ShopMembers + orphan booking seats (not invites).
  const linkedBarberIds = new Set(
    [...members.map((m) => m.barberId), ...invites.map((i) => i.barberId)].filter(
      (id): id is string => Boolean(id),
    ),
  );
  const orphanBarberCount = allBarbers.filter((b) => !linkedBarberIds.has(b.id) && !b.userId).length;
  const teamProfileCount = members.length + orphanBarberCount;

  const retailComplete =
    Boolean(shop.retailPickupWalkthroughCompletedAt) || Boolean(shop.retailOnboardingSkipped);

  const progress = buildLaunchProgress({
    onboardingCompleted: Boolean(shop.onboardingCompleted),
    teamProfileCount,
    serviceCount: shop._count.services,
    retailComplete,
  });

  if (!shop.onboardingCompleted) {
    const paidHref = shopPaid ? getSetupOnboardingFormUrlOrEmpty().trim() || '/admin' : null;
    return new Response(
      JSON.stringify({
        ok: true,
        onboardingCompleted: false,
        pending: null,
        paid: shopPaid,
        paidHref,
        progress,
        shop: shopPayload,
        user: userPayload,
      }),
    );
  }

  const email = access.userEmail?.trim().toLowerCase() || null;
  let pendingDeposit: LaunchPending | null = null;
  let hasPaidDeposit = false;

  if (email) {
    const [pendingRow, paidDeposit] = await Promise.all([
      prisma.setupDeposit.findFirst({
        where: {
          customerEmail: { equals: email, mode: 'insensitive' },
          status: SetupDepositStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          plan: true,
          shopSize: true,
          currentStack: true,
        },
      }),
      prisma.setupDeposit.findFirst({
        where: {
          customerEmail: { equals: email, mode: 'insensitive' },
          status: SetupDepositStatus.PAID,
        },
        select: { id: true },
      }),
    ]);

    if (pendingRow) {
      pendingDeposit = {
        plan: setupPlanToId(pendingRow.plan),
        shopSize: pendingRow.shopSize,
        currentStack: pendingRow.currentStack,
      };
    }
    hasPaidDeposit = Boolean(paidDeposit);
  }

  const { paid, pending } = resolveLaunchBillingFlags({
    shopPaid,
    pendingDeposit,
    hasPaidDeposit,
  });

  const paidHref = paid ? getSetupOnboardingFormUrlOrEmpty().trim() || '/admin' : null;

  return new Response(
    JSON.stringify({
      ok: true,
      onboardingCompleted: true,
      pending,
      paid,
      paidHref,
      progress,
      shop: shopPayload,
      user: userPayload,
    }),
  );
};
