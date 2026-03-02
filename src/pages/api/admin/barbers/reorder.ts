export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
  includeInactive: z.boolean().optional().default(false)
});

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const parsed = reorderSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const where = parsed.data.includeInactive ? {} : { active: true };
    const existing = await prisma.barber.findMany({ where, select: { id: true } });
    const existingIds = new Set(existing.map((barber) => barber.id));

    if (existing.length !== parsed.data.orderedIds.length || parsed.data.orderedIds.some((id) => !existingIds.has(id))) {
      return new Response(JSON.stringify({ error: 'Invalid barber ids.' }), { status: 400 });
    }

    await prisma.$transaction(
      parsed.data.orderedIds.map((id, index) => prisma.barber.update({ where: { id }, data: { sortOrder: index } }))
    );

    const barbers = await prisma.barber.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, email: true, avatarUrl: true, active: true, sortOrder: true, createdAt: true }
    });

    return new Response(JSON.stringify({
      ok: true,
      barbers: barbers.map((barber) => ({ ...barber, isActive: barber.active }))
    }), { status: 200 });
  } catch (error) {
    console.error('Failed to reorder barbers', error);
    return new Response(JSON.stringify({ error: 'Unable to reorder barbers.' }), { status: 500 });
  }
};
