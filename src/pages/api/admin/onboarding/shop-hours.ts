export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  advanceOnboardingStep,
  loadOnboardingState,
  ONBOARDING_STEP_BARBERS,
  requireOnboardingAccess,
  timeStringToMinutes,
  type OnboardingWeeklyRule,
} from '@/lib/admin/onboarding';
import { replaceShopOpeningHours } from '@/lib/admin/shopOpeningHours';

const rowSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  active: z.boolean(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const payloadSchema = z.object({
  rules: z.array(rowSchema).length(7),
});

function validateRules(rules: OnboardingWeeklyRule[]) {
  let activeCount = 0;
  for (const rule of rules) {
    if (!rule.active) continue;
    activeCount += 1;
    const startMinutes = timeStringToMinutes(rule.startTime);
    const endMinutes = timeStringToMinutes(rule.endTime);
    if (startMinutes >= endMinutes) {
      return `Day ${rule.dayOfWeek}: end time must be later than start time.`;
    }
  }
  if (activeCount === 0) {
    return 'Open the shop on at least one day.';
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

    await replaceShopOpeningHours(shopId, parsed.data.rules);
    await advanceOnboardingStep(shopId, ONBOARDING_STEP_BARBERS);
    const state = await loadOnboardingState(shopId, access);
    return new Response(JSON.stringify(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save shop opening hours.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
