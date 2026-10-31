export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { analyticsClientIdFromRequest } from '@/lib/analytics/serverEvents';
import { approveLaunch } from '@/lib/freePreview/hubLaunch';
import { launchJson, requireLaunchOwner } from '@/lib/freePreview/hubLaunchApi';

const schema = z.object({
  contentRightsConfirmed: z.literal(true),
  informationAccuracyConfirmed: z.literal(true),
});

export const POST: APIRoute = async (ctx) => {
  const access = await requireLaunchOwner(ctx, 'MUTATE');
  if (access instanceof Response) return access;
  const body = await ctx.request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return launchJson({ error: 'Confirm both declarations before approving.' }, 400);

  const result = await approveLaunch({
    shopId: access.shopId,
    previewRequestId: access.previewRequestId,
    contentRightsConfirmed: parsed.data.contentRightsConfirmed,
    informationAccuracyConfirmed: parsed.data.informationAccuracyConfirmed,
    clientId: analyticsClientIdFromRequest(ctx.request),
  });
  if (!result.ok) {
    const status = result.code === 'NOT_FOUND' ? 404 : 400;
    const error =
      result.code === 'BUSINESS_INCOMPLETE'
        ? 'Finish your business details before you approve.'
        : result.code === 'CONFIRMATIONS_REQUIRED'
          ? 'Confirm both declarations before approving.'
          : 'Not found.';
    return launchJson({ error }, status);
  }
  return launchJson({ ok: true, checklist: result.state });
};
