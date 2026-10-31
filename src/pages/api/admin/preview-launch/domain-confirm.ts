export const prerender = false;

import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest } from '@/lib/analytics/serverEvents';
import { confirmLaunchDomain } from '@/lib/freePreview/hubLaunch';
import { launchJson, requireLaunchOwner } from '@/lib/freePreview/hubLaunchApi';

export const POST: APIRoute = async (ctx) => {
  const access = await requireLaunchOwner(ctx, 'MUTATE');
  if (access instanceof Response) return access;
  const state = await confirmLaunchDomain({
    shopId: access.shopId,
    previewRequestId: access.previewRequestId,
    clientId: analyticsClientIdFromRequest(ctx.request),
  });
  return launchJson({ ok: true, checklist: state });
};
