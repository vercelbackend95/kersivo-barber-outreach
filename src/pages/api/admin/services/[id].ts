export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(280).optional().nullable(),
  pricePence: z.number().int().min(0).optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  displayOrder: z.number().int().min(0).optional(),
  category: z.string().trim().max(80).optional().nullable(),
  isActive: z.boolean().optional()
});

export const PATCH: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const id = ctx.params.id;
  if (!id) return new Response(JSON.stringify({ error: 'Missing service id.' }), { status: 400 });

  const parsed = updateSchema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });

  const data = parsed.data;
  const service = await prisma.service.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.pricePence !== undefined ? { pricePence: data.pricePence } : {}),
      ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
      ...(data.bufferMinutes !== undefined ? { bufferMinutes: data.bufferMinutes } : {}),
      ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
      ...(data.category !== undefined ? { category: data.category?.trim() || null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
    }
  });

  return new Response(JSON.stringify({ service }));
};
