export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1)
});

const serviceInclude = {
  barberServices: {
    orderBy: {
      barber: {
        sortOrder: 'asc' as const
      }
    },
    select: {
      barber: {
        select: {
          id: true,
          name: true,
          active: true
        }
      }
    }
  }
};

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const parsed = reorderSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const { orderedIds } = parsed.data;

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.service.update({
          where: { id },
          data: { displayOrder: index }
        })
      )
    );

    const services = await prisma.service.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: serviceInclude
    });

    return new Response(JSON.stringify({ ok: true, services }), { status: 200 });
  } catch (error) {
    console.error('Failed to reorder services', error);
    return new Response(JSON.stringify({ error: 'Unable to reorder services.' }), { status: 500 });
  }
};
