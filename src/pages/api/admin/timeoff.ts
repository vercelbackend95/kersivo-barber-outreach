import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';

const schema = z.object({ id: z.string().optional(), barberId: z.string(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), reason: z.string().optional() });

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const rows = await prisma.barberTimeOff.findMany({ orderBy: { startsAt: 'asc' } });
  return new Response(JSON.stringify({ timeOff: rows }));
};

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  const { id, startsAt, endsAt, ...data } = parsed.data;
  const payload = { ...data, startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
  const row = id ? await prisma.barberTimeOff.update({ where: { id }, data: payload }) : await prisma.barberTimeOff.create({ data: payload });
  return new Response(JSON.stringify({ timeOff: row }));
};
