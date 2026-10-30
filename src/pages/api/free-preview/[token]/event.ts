export const prerender = false;

import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { PREVIEW_EVENT_RATE, previewApiGuard, previewJson } from '@/lib/freePreview/previewApi';
import { resolvePreviewRequestByToken } from '@/lib/freePreview/previewAccess';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

/**
 * preview_launch_click from the top bar. The preview page loads no analytics tags because its URL holds the
 * token, so the click reaches GA4 through the server, subject to the same Analytics consent.
 */
export const POST: APIRoute = async ({ request, params }) => {
  const blocked = previewApiGuard(request);
  if (blocked) return blocked;

  const limited = await enforceIpRateLimit(
    request,
    PREVIEW_EVENT_RATE.action,
    PREVIEW_EVENT_RATE.limit,
    PREVIEW_EVENT_RATE.windowMs,
  );
  if (limited) return limited;

  const preview = await resolvePreviewRequestByToken(params.token ?? '');
  if (!preview) return previewJson({ ok: false, error: 'Not found.' }, 404);

  await sendServerAnalyticsEvent({
    name: FUNNEL_EVENTS.preview_launch_click,
    clientId: analyticsClientIdFromRequest(request),
  });
  return previewJson({ ok: true });
};
