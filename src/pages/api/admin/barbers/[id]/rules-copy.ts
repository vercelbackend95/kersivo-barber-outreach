export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { prisma } from '../../../../../lib/db/client';

const schema = z.object({ sourceBarberId: z.string().min(1) });

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const barberId = ctx.params.id;
  if (!barberId) return new Response(JSON.stringify({ error: 'Missing barber id.' }), { status: 400 });

  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const sourceRules = await prisma.availabilityRule.findMany({
    where: { barberId: parsed.data.sourceBarberId, active: true },
    orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }],
    select: { dayOfWeek: true, startMinutes: true, endMinutes: true }
  });

  if (sourceRules.length === 0) {
    return new Response(JSON.stringify({ error: 'Source barber has no active schedule to copy.' }), { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.availabilityRule.deleteMany({ where: { barberId } });
    await tx.availabilityRule.createMany({
      data: sourceRules.map((rule) => ({
        barberId,
        dayOfWeek: rule.dayOfWeek,
        startMinutes: rule.startMinutes,
        endMinutes: rule.endMinutes,
        active: true,
        breakStartMin: null,
        breakEndMin: null
      }))
    });
  });

  return new Response(JSON.stringify({ ok: true }));
};
