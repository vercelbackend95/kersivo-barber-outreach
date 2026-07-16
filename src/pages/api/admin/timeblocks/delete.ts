export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext } from '../../../../lib/admin/auth';
import { prisma } from '../../../../lib/db/client';
import { getTimeBlockDelegate } from '../../../../lib/db/timeBlocks';

const schema = z.object({ id: z.string().min(1) });

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const timeBlockDelegate = getTimeBlockDelegate();
  if (!timeBlockDelegate) {
    return new Response(
      JSON.stringify({
        error: 'Prisma client is missing the timeBlock delegate. Run `npx prisma generate`.',
      }),
      { status: 500 },
    );
  }

  const existing = await prisma.timeBlock.findFirst({
    where: { id: parsed.data.id, shopId: access.shopId },
    select: { id: true },
  });
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Time block not found.' }), { status: 404 });
  }

  await timeBlockDelegate.delete({ where: { id: existing.id } });

  return new Response(JSON.stringify({ ok: true }));
};
