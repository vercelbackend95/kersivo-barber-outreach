export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';

const schema = z.object({ id: z.string().optional(), barberId: z.string(), dayOfWeek: z.number().int().min(0).max(6), startMinutes: z.number().int().min(0).max(1440), endMinutes: z.number().int().min(1).max(1440), breakStartMin: z.number().int().optional().nullable(), breakEndMin: z.number().int().optional().nullable(), active: z.boolean().default(true) });

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const rows = await prisma.availabilityRule.findMany({ orderBy: [{ barberId: 'asc' }, { dayOfWeek: 'asc' }] });
  return new Response(JSON.stringify({ rules: rows }));
};

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  const { id, ...data } = parsed.data;
  const rule = id ? await prisma.availabilityRule.update({ where: { id }, data }) : await prisma.availabilityRule.create({ data });
  return new Response(JSON.stringify({ rule }));
};
