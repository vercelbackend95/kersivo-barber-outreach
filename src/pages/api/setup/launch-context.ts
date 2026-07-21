export const prerender = false;

import type { APIRoute } from 'astro';
import { SetupDepositStatus, SetupPlan } from '@prisma/client';
import { resolveAdminAccess } from '../../../lib/admin/auth';
import { requirePermission } from '../../../lib/admin/rbac/can';
import { prisma } from '../../../lib/db/client';
import type { SetupPlanId } from '../../../lib/setup/plans';

function setupPlanToId(plan: SetupPlan): SetupPlanId {
  return plan === SetupPlan.PRIORITY ? 'priority' : 'launch';
}

/**
 * Context for Launch Wizard: Owner billing gate + optional PENDING deposit for continue_purchase.
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
      onboardingCompleted: true,
      name: true,
      townCity: true,
      barbers: {
        where: { active: true },
        select: { id: true, name: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      },
    },
  });

  if (!shop) {
    return new Response(JSON.stringify({ error: 'Shop not found.' }), { status: 404 });
  }

  const shopPayload = {
    name: shop.name,
    townCity: shop.townCity?.trim() || null,
    barbers: shop.barbers.map((barber) => ({ id: barber.id, name: barber.name })),
  };

  const userPayload = {
    name: access.userName,
    email: access.userEmail,
  };

  if (!shop.onboardingCompleted) {
    return new Response(
      JSON.stringify({
        ok: true,
        onboardingCompleted: false,
        pending: null,
        shop: shopPayload,
        user: userPayload,
      }),
    );
  }

  const email = access.userEmail?.trim().toLowerCase() || null;
  let pending: {
    plan: SetupPlanId;
    shopSize: string;
    currentStack: string;
  } | null = null;

  if (email) {
    const pendingDeposit = await prisma.setupDeposit.findFirst({
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
    });

    if (pendingDeposit) {
      pending = {
        plan: setupPlanToId(pendingDeposit.plan),
        shopSize: pendingDeposit.shopSize,
        currentStack: pendingDeposit.currentStack,
      };
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      onboardingCompleted: true,
      pending,
      shop: shopPayload,
      user: userPayload,
    }),
  );
};
