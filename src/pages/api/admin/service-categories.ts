export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminContext } from '../../../lib/admin/auth';
import {
  ensureCustomServiceCategory,
  loadMergedServiceCategories,
  normalizeServiceCategory,
} from '../../../lib/admin/serviceCategories';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Category name is required.').max(80),
});

export const POST: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const parsed = createSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const normalized = normalizeServiceCategory(parsed.data.name);
  if (!normalized) {
    return new Response(JSON.stringify({ error: 'Category name is required.' }), { status: 400 });
  }

  const categories = await ensureCustomServiceCategory(access.shopId, normalized);
  return new Response(JSON.stringify({ category: normalized, categories }), { status: 201 });
};

export const GET: APIRoute = async (ctx) => {
  const access = await requireAdminContext(ctx);
  if (access instanceof Response) return access;

  const categories = await loadMergedServiceCategories(access.shopId);
  return new Response(JSON.stringify({ categories }));
};
