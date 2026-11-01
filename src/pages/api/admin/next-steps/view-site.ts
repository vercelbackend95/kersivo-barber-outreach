export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAdminPermission } from '@/lib/admin/auth';
import { markNextStepsWebsiteViewed } from '@/lib/adminHub/nextSteps';
import { isAdminHubEnabled } from '@/lib/freePreview/config';

export const POST: APIRoute = async (ctx) => {
  if (!isAdminHubEnabled()) {
    return new Response(JSON.stringify({ error: 'Not found.' }), { status: 404 });
  }
  const access = await requireAdminPermission(ctx, 'billing.manage');
  if (access instanceof Response) return access;
  if (access.via !== 'session') {
    return new Response(JSON.stringify({ error: 'Sign in required.' }), { status: 403 });
  }

  const nextSteps = await markNextStepsWebsiteViewed(access.shopId);
  if (!nextSteps) {
    return new Response(JSON.stringify({ ok: true, nextSteps: null }), { status: 200 });
  }
  return new Response(JSON.stringify({ ok: true, nextSteps }), { status: 200 });
};
