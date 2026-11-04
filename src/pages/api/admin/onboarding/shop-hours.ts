export const prerender = false;

import type { APIRoute } from 'astro';
import { legacyHoursPayloadSchema, validateWeeklyHoursRows } from '@/lib/shopData/schema';
import {
  advanceOnboardingStep,
  loadOnboardingState,
  ONBOARDING_STEP_BARBERS,
  requireOnboardingAccess,
  type OnboardingWeeklyRule,
} from '@/lib/admin/onboarding';
import { replaceShopOpeningHours } from '@/lib/admin/shopOpeningHours';

const payloadSchema = legacyHoursPayloadSchema;

function validateRules(rules: OnboardingWeeklyRule[]) {
  return validateWeeklyHoursRows(rules, { emptyMessage: 'Open the shop on at least one day.' });
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
