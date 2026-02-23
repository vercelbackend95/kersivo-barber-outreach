export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';

const schema = z.object({ id: z.string().optional(), name: z.string().min(1), durationMinutes: z.number().int().positive(), fromPriceText: z.string().optional(), bufferMinutes: z.number().int().min(0).default(0), active: z.boolean().default(true) });

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const services = await prisma.service.findMany({ orderBy: { createdAt: 'asc' } });
  return new Response(JSON.stringify({ services }));
};

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx); if (unauthorized) return unauthorized;
  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  const { id, ...data } = parsed.data;
  const service = id ? await prisma.service.update({ where: { id }, data }) : await prisma.service.create({ data });
  return new Response(JSON.stringify({ service }));
};
