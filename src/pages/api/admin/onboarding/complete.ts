export const prerender = false;

import type { APIRoute } from 'astro';
import {
  loadOnboardingState,
  ONBOARDING_STEP_REVIEW,
  requireOnboardingAccess,
} from '@/lib/admin/onboarding';
import { prisma } from '@/lib/db/client';

export const POST: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  try {
    const shop = await prisma.shopSettings.findUniqueOrThrow({
      where: { id: shopId },
      select: {
        name: true,
        onboardingCompleted: true,
      },
    });

    if (!shop.name.trim()) {
      return new Response(JSON.stringify({ error: 'Barbershop name is required.' }), { status: 400 });
    }

    const [barberCount, serviceCount, firstBarber] = await Promise.all([
      prisma.barber.count({ where: { shopId, active: true } }),
      prisma.service.count({ where: { shopId, isActive: true } }),
      prisma.barber.findFirst({
        where: { shopId, active: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          rules: {
            where: { active: true },
            select: { dayOfWeek: true, startMinutes: true, endMinutes: true },
          },
        },
      }),
    ]);

    if (barberCount < 1) {
      return new Response(JSON.stringify({ error: 'Add at least one barber before finishing setup.' }), {
        status: 400,
      });
    }
    if (serviceCount < 1) {
      return new Response(JSON.stringify({ error: 'Add at least one service before finishing setup.' }), {
        status: 400,
      });
    }
    if (!firstBarber || firstBarber.rules.length === 0) {
      return new Response(JSON.stringify({ error: 'Set valid working hours before finishing setup.' }), {
        status: 400,
      });
    }

    for (const rule of firstBarber.rules) {
      if (rule.startMinutes >= rule.endMinutes) {
        return new Response(JSON.stringify({ error: 'Working hours must have an end time later than start time.' }), {
          status: 400,
        });
      }
    }

    if (!shop.onboardingCompleted) {
      await prisma.shopSettings.update({
        where: { id: shopId },
        data: {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          onboardingCurrentStep: ONBOARDING_STEP_REVIEW,
        },
      });
    }

    const state = await loadOnboardingState(shopId, access);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete onboarding.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
