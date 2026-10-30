export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { resolveAdminAccess } from '@/lib/admin/auth';
import { requireClientOnboardingAccess } from '@/lib/admin/clientOnboarding/service';
import { prisma } from '@/lib/db/client';
import { searchDomains } from '@/lib/domains/search';

const bodySchema = z.object({
  query: z.string().trim().max(63).optional().default(''),
});

/** Same searcher as the preview launch panel, scoped to the paid shop's name and town. */
export const POST: APIRoute = async (ctx) => {
  const accessOrErr = await requireClientOnboardingAccess(await resolveAdminAccess(ctx));
  if (accessOrErr instanceof Response) return accessOrErr;

  let body: unknown;
  try {
    body = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Enter a shorter search.' }), { status: 400 });
  }

  const shop = await prisma.shopSettings.findUnique({
    where: { id: accessOrErr.shopId },
    select: {
      name: true,
      townCity: true,
      clientOnboarding: { select: { townCity: true } },
    },
  });
  if (!shop) {
    return new Response(JSON.stringify({ error: 'Shop not found.' }), { status: 404 });
  }

  try {
    const result = await searchDomains({
      shopName: shop.name,
      townCity: shop.clientOnboarding?.townCity || shop.townCity || '',
      query: parsed.data.query,
    });
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check domains just now.';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
