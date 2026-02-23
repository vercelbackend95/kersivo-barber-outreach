export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin/auth';

export const GET: APIRoute = async (context) => {
  const unauthorized = requireAdmin(context);
  if (unauthorized) return unauthorized;

  return new Response(JSON.stringify({ ok: true }));
};
