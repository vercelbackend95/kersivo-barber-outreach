import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { brandColoursSchema, saveBrandColours } from '@/lib/adminHub/brandColours';
import {
  enforceHubDetailsRate,
  hubJson,
  hubLogRef,
  requireEditDetailsCapability,
  resolveHubApiContext,
  type HubSourceOf,
} from '@/lib/freePreview/hubApi';

export function createHubBrandColoursHandlers(sourceOf: HubSourceOf): { PATCH: APIRoute } {
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
    const parsed = brandColoursSchema.safeParse(body);
    if (!parsed.success) {
      return hubJson({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid request body.' }, 400);
    }

    try {
      const colours = await saveBrandColours({ requestId: ctxResult.ctx.request.id, patch: parsed.data });
      if (parsed.data.send && !ctxResult.ctx.isOperator) {
        await sendServerAnalyticsEvent({
          name: FUNNEL_EVENTS.hub_brand_colours_sent,
          clientId: analyticsClientIdFromRequest(request),
        });
      }
      return hubJson({ ok: true, colours });
    } catch (error) {
      console.error('[preview-hub] brand colours save failed', {
        token: hubLogRef(source),
        error: error instanceof Error ? error.message : error,
      });
      return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
    }
  };

  return { PATCH };
}
