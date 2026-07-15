export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  advanceOnboardingStep,
  loadOnboardingState,
  markOnboardingCompleted,
  ONBOARDING_STEP_REVIEW,
  replaceBarberAvailabilityRules,
  requireOnboardingAccess,
  timeStringToMinutes,
  type OnboardingWeeklyRule,
} from '@/lib/admin/onboarding';
import { prisma } from '@/lib/db/client';

const rowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  active: z.boolean(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const payloadSchema = z.object({
  rules: z.array(rowSchema).length(7),
  applyToAllBarbers: z.boolean().default(true),
});

function validateRules(rules: OnboardingWeeklyRule[]) {
  for (const rule of rules) {
    if (!rule.active) continue;
    const startMinutes = timeStringToMinutes(rule.startTime);
    const endMinutes = timeStringToMinutes(rule.endTime);
    if (startMinutes >= endMinutes) {
      return `Day ${rule.dayOfWeek}: end time must be later than start time.`;
    }
  }
  return null;
}

export const PUT: APIRoute = async (ctx) => {
  const access = await requireOnboardingAccess(ctx);
  if (access instanceof Response) return access;
  const shopId = access.shopId;

  try {
    const parsed = payloadSchema.safeParse(await ctx.request.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
    }

    const validationError = validateRules(parsed.data.rules);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), { status: 400 });
    }

    const barbers = await prisma.barber.findMany({
      where: { shopId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    if (barbers.length === 0) {
      return new Response(JSON.stringify({ error: 'Add at least one barber before setting hours.' }), {
        status: 400,
      });
    }

    const targets = parsed.data.applyToAllBarbers ? barbers : [barbers[0]!];
    for (const barber of targets) {
      await replaceBarberAvailabilityRules(barber.id, parsed.data.rules);
    }

    await advanceOnboardingStep(shopId, ONBOARDING_STEP_REVIEW);
    await markOnboardingCompleted(shopId);
    const state = await loadOnboardingState(shopId, access);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save working hours.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
