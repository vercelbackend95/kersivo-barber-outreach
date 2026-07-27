export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext } from '@/lib/admin/auth';
import { requireAnyPermission } from '@/lib/admin/rbac/can';
import {
  replaceShopOpeningHours,
  serializeShopOpeningHours,
  type OnboardingWeeklyRule,
} from '@/lib/admin/shopOpeningHours';
import { timeStringToMinutes } from '@/lib/admin/timeStrings';

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
    return 'Open the barbershop on at least one day.';
  }
  return null;
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
