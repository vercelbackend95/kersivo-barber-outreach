export const prerender = false;

import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { hubJson, hubNotFoundJson, resolveHubApiContext } from '@/lib/freePreview/hubApi';
import { isAdminHubRouteEnabled } from '@/lib/freePreview/hubPage';
import { PREVIEW_EVENT_RATE } from '@/lib/freePreview/previewApi';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

/** preview_launch_click from the hub's launch button. Never sent for operators. */
export const POST: APIRoute = async ({ request }) => {
  if (!isAdminHubRouteEnabled()) return hubNotFoundJson();

  const limited = await enforceIpRateLimit(
    request,
    PREVIEW_EVENT_RATE.action,
    PREVIEW_EVENT_RATE.limit,
    PREVIEW_EVENT_RATE.windowMs,
  );
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, source: { kind: 'cookie' }, mutation: true });
  if (!ctxResult.ok) return ctxResult.response;

  if (!ctxResult.ctx.isOperator) {
    await sendServerAnalyticsEvent({
      name: FUNNEL_EVENTS.preview_launch_click,
      clientId: analyticsClientIdFromRequest(request),
    });
  }
  return hubJson({ ok: true });
};
