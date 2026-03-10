export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../lib/admin/auth';
import { prisma } from '../../../lib/db/client';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(280).optional().nullable(),
  pricePence: z.number().int().min(0),
  durationMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(120).default(0),
  displayOrder: z.number().int().min(0).default(0),
  category: z.string().trim().max(80).optional().nullable(),
  isActive: z.boolean().default(true)
});
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const services = await prisma.service.findMany({
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
  });


  return new Response(JSON.stringify({ services }));
};

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const parsed = createSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const payload = parsed.data;
  const service = await prisma.service.create({
    data: {
      name: payload.name,
      description: payload.description?.trim() || null,
      pricePence: payload.pricePence,
      durationMinutes: payload.durationMinutes,
      bufferMinutes: payload.bufferMinutes,
      displayOrder: payload.displayOrder,
      category: payload.category?.trim() || null,
      isActive: payload.isActive
    }
  });

  return new Response(JSON.stringify({ service }), { status: 201 });

};
