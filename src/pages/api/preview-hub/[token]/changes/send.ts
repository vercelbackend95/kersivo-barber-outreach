export const prerender = false;

import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import {
  enforceHubChangesRate,
  hubJson,
  requireDraftChangesCapability,
  requireSendChangesCapability,
  resolveHubApiContext,
} from '@/lib/freePreview/hubApi';
import { sendHubChanges } from '@/lib/freePreview/hubChanges';
import { tokenPrefixForLog } from '@/lib/freePreview/hubPage';

export const POST: APIRoute = async ({ request, params }) => {
  const limited = await enforceHubChangesRate(request);
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: true });
  if (!ctxResult.ok) return ctxResult.response;
  const draftDenied = requireDraftChangesCapability(ctxResult.ctx);
  if (draftDenied) return draftDenied;
  const sendDenied = requireSendChangesCapability(ctxResult.ctx);
  if (sendDenied) return sendDenied;

  try {
    const result = await sendHubChanges({ previewRequestId: ctxResult.ctx.request.id });
    if (!result.ok) {
      const status = result.code === 'ROUND_USED' ? 403 : result.code === 'NO_DRAFTS' ? 400 : 409;
      return hubJson({ ok: false, error: result.error, code: result.code }, status);
    }
    if (!ctxResult.ctx.isOperator) {
      await sendServerAnalyticsEvent({
        name: FUNNEL_EVENTS.hub_changes_sent,
        clientId: analyticsClientIdFromRequest(request),
      });
    }
    return hubJson({ ok: true, round: result.round, items: result.items });
  } catch (error) {
    console.error('[preview-hub] send changes failed', {
      token: tokenPrefixForLog(params.token ?? ''),
      error: error instanceof Error ? error.message : error,
    });
    return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  }
};
