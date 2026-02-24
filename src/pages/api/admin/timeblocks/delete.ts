export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../../lib/admin/auth';
import { getTimeBlockDelegate } from '../../../../lib/db/timeBlocks';

const schema = z.object({ id: z.string().min(1) });

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const parsed = schema.safeParse(await ctx.request.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });

  const timeBlockDelegate = getTimeBlockDelegate();
  if (!timeBlockDelegate) {
    return new Response(JSON.stringify({ error: 'Prisma client is missing the timeBlock delegate. Run `npx prisma generate`.' }), { status: 500 });
  }

  await timeBlockDelegate.delete({ where: { id: parsed.data.id } });

  return new Response(JSON.stringify({ ok: true }));
};
