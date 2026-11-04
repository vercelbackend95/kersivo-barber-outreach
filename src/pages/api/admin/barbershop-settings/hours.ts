export const prerender = false;

import type { APIRoute } from 'astro';
import { legacyHoursPayloadSchema, validateWeeklyHoursRows } from '@/lib/shopData/schema';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import {
  replaceShopOpeningHours,
  serializeShopOpeningHours,
  type OnboardingWeeklyRule,
} from '@/lib/admin/shopOpeningHours';

const payloadSchema = legacyHoursPayloadSchema;

function validateRules(rules: OnboardingWeeklyRule[]) {
  return validateWeeklyHoursRows(rules, { emptyMessage: 'Open the barbershop on at least one day.' });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PUT: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const denied = requireAnyPermission(access, ['shop.settings']);
  if (denied) return denied;

  try {
    const parsed = payloadSchema.safeParse(await ctx.request.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten() }, 400);
    }

    const validationError = validateRules(parsed.data.rules);
    if (validationError) {
      return json({ error: validationError }, 400);
    }

    await replaceShopOpeningHours(access.shopId, parsed.data.rules);
    const hours = await serializeShopOpeningHours(access.shopId);
    return json({ hours });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save opening hours.';
    return json({ error: message }, 500);
  }
};
