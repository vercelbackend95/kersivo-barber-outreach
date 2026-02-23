export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';

const schema = z.object({ id: z.string().optional(), name: z.string().min(1), email: z.string().email().optional().or(z.literal('')), active: z.boolean().default(true) });

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const barbers = await prisma.barber.findMany({ orderBy: { createdAt: 'asc' } });
  return new Response(JSON.stringify({ barbers }));
};

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  const { id, email, ...rest } = parsed.data;
  const data = { ...rest, email: email || null };
  const barber = id ? await prisma.barber.update({ where: { id }, data }) : await prisma.barber.create({ data });
  return new Response(JSON.stringify({ barber }));
};
