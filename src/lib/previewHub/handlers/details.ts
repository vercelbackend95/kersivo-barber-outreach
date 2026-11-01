import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import {
  enforceHubDetailsRate,
  hubJson,
  hubLogRef,
  requireEditDetailsCapability,
  resolveHubApiContext,
  type HubSourceOf,
} from '@/lib/freePreview/hubApi';
import { hubDetailsSchema, saveHubDetails } from '@/lib/freePreview/hubDetails';

export function createHubDetailsHandlers(sourceOf: HubSourceOf): { PATCH: APIRoute } {
  const PATCH: APIRoute = async ({ request, params }) => {
    const source = sourceOf(params);
    const limited = await enforceHubDetailsRate(request);
    if (limited) return limited;

    const ctxResult = await resolveHubApiContext({ request, source, mutation: true });
    if (!ctxResult.ok) return ctxResult.response;
    const denied = requireEditDetailsCapability(ctxResult.ctx);
    if (denied) return denied;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return hubJson({ ok: false, error: 'Invalid request body.' }, 400);
    }
    const parsed = hubDetailsSchema.safeParse(body);
    if (!parsed.success) {
      return hubJson({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid request body.' }, 400);
    }

    try {
      const details = await saveHubDetails({ requestId: ctxResult.ctx.request.id, patch: parsed.data });
      if (!ctxResult.ctx.isOperator) {
        await sendServerAnalyticsEvent({
          name: FUNNEL_EVENTS.hub_details_saved,
          clientId: analyticsClientIdFromRequest(request),
        });
      }
      return hubJson({ ok: true, details });
    } catch (error) {
      console.error('[preview-hub] details save failed', {
        token: hubLogRef(source),
        error: error instanceof Error ? error.message : error,
      });
      return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
    }
  };

  return { PATCH };
}
