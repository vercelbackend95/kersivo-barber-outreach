export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdmin } from '../../../lib/admin/auth';
import {
  ensureCustomServiceCategory,
  loadMergedServiceCategories,
  normalizeServiceCategory
} from '../../../lib/admin/serviceCategories';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Category name is required.').max(80)
});

export const POST: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const parsed = createSchema.safeParse(await ctx.request.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const normalized = normalizeServiceCategory(parsed.data.name);
  if (!normalized) {
    return new Response(JSON.stringify({ error: 'Category name is required.' }), { status: 400 });
  }

  const categories = await ensureCustomServiceCategory(normalized);
  return new Response(JSON.stringify({ category: normalized, categories }), { status: 201 });
};

export const GET: APIRoute = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;

  const categories = await loadMergedServiceCategories();
  return new Response(JSON.stringify({ categories }));
};
