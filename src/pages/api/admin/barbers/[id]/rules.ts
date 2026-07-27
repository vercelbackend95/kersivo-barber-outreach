export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext, requireAdminPermission } from '../../../../../lib/admin/auth';
import { requireAnyPermission } from '../../../../../lib/admin/rbac/can';
import { findShopBarber } from '../../../../../lib/admin/shopScoped';
import {
  assertBarberHoursWithinShop,
  loadShopOpeningHoursDays,
  serializeShopOpeningHours,
} from '../../../../../lib/admin/shopOpeningHours';
import { prisma } from '../../../../../lib/db/client';
import { ALL_WEEKDAYS } from '../../../../../lib/booking/weekdays';

const rowSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  active: z.boolean(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const payloadSchema = z.object({
  rules: z.array(rowSchema).length(7),
});

function minutesToTimeString(minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function timeStringToMinutes(value: string) {
  const [hh, mm] = value.split(':').map(Number);
  return hh * 60 + mm;
}

async function serializeRules(barberId: string) {
  const rules = await prisma.availabilityRule.findMany({
    where: { barberId },
    orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }],
    select: { id: true, dayOfWeek: true, active: true, startMinutes: true, endMinutes: true },
  });

  const byDay = new Map(rules.map((rule) => [rule.dayOfWeek, rule]));
  return ALL_WEEKDAYS.map((dayOfWeek) => {
    const rule = byDay.get(dayOfWeek);
    return {
      dayOfWeek,
      active: rule?.active ?? false,
      startTime: minutesToTimeString(rule?.startMinutes ?? 10 * 60),
      endTime: minutesToTimeString(rule?.endMinutes ?? 18 * 60),
    };
  });
}

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;
  const denied = requireAnyPermission(access, ['catalog.manage', 'team.read']);
  if (denied) return denied;

  const barberId = ctx.params.id;
  if (!barberId) {
    return new Response(JSON.stringify({ error: 'Missing barber id.' }), { status: 400 });
  }

  const barber = await findShopBarber(barberId, access.shopId);
  if (!barber) {
    return new Response(JSON.stringify({ error: 'Barber not found.' }), { status: 404 });
  }

  const rules = await serializeRules(barber.id);
  return new Response(JSON.stringify({ rules }));
};

export const PUT: APIRoute = async (ctx) => {
  const access = await requireAdminPermission(ctx, 'catalog.manage');
  if (access instanceof Response) return access;

  const barberId = ctx.params.id;
  if (!barberId) {
    return new Response(JSON.stringify({ error: 'Missing barber id.' }), { status: 400 });
  }

  const barber = await findShopBarber(barberId, access.shopId);
  if (!barber) {
    return new Response(JSON.stringify({ error: 'Barber not found.' }), { status: 404 });
  }

  const parsed = payloadSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  for (const rule of parsed.data.rules) {
    const startMinutes = timeStringToMinutes(rule.startTime);
    const endMinutes = timeStringToMinutes(rule.endTime);
    if (rule.active && startMinutes >= endMinutes) {
      return new Response(
        JSON.stringify({ error: `Day ${rule.dayOfWeek}: start time must be earlier than end time.` }),
        { status: 400 },
      );
    }
  }

  const shopOpenDays = await loadShopOpeningHoursDays(access.shopId);
  if (shopOpenDays.length > 0) {
    const shopHours = await serializeShopOpeningHours(access.shopId);
    const withinShopError = assertBarberHoursWithinShop(shopHours, parsed.data.rules);
    if (withinShopError) {
      return new Response(JSON.stringify({ error: withinShopError }), { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.availabilityRule.deleteMany({ where: { barberId: barber.id } });
    await tx.availabilityRule.createMany({
      data: parsed.data.rules.map((rule) => ({
        barberId: barber.id,
        dayOfWeek: rule.dayOfWeek,
        active: rule.active,
        startMinutes: timeStringToMinutes(rule.startTime),
        endMinutes: timeStringToMinutes(rule.endTime),
        breakStartMin: null,
        breakEndMin: null,
      })),
    });
  });

  return new Response(JSON.stringify({ rules: await serializeRules(barber.id) }));
};
