import type { APIRoute } from 'astro';
import { enforceHubStateGetRate, hubJson, resolveHubApiContext, type HubSourceOf } from '@/lib/freePreview/hubApi';
import { PRIVATE_PREVIEW_HEADERS } from '@/lib/freePreview/previewHeaders';
import { loadAdminHubLiveState } from '@/lib/adminHub/liveState.server';

function withPrivateHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(PRIVATE_PREVIEW_HEADERS)) response.headers.set(name, value);
  return response;
}

/** GET: the live hub data the Overview tiles and app windows read (`hubStore.ts`). */
export function createHubStateHandlers(sourceOf: HubSourceOf): { GET: APIRoute } {
  const GET: APIRoute = async ({ request, params }) => {
    const limited = await enforceHubStateGetRate(request);
    if (limited) return withPrivateHeaders(limited);
    const ctxResult = await resolveHubApiContext({ request, source: sourceOf(params), mutation: false });
    if (!ctxResult.ok) return withPrivateHeaders(ctxResult.response);
    const state = await loadAdminHubLiveState(ctxResult.ctx);
    return withPrivateHeaders(hubJson({ ok: true, state }));
  };
  return { GET };
}
