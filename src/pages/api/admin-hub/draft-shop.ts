export const prerender = false;

import type { APIRoute } from 'astro';
import { ensureHubDraftShop } from '@/lib/freePreview/ensureHubDraftShop';
import {
  enforceHubDetailsRate,
  hubJson,
  hubNotFoundJson,
  resolveHubApiContext,
} from '@/lib/freePreview/hubApi';
import { isAdminHubRouteEnabled } from '@/lib/freePreview/hubPage';

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminHubRouteEnabled()) return hubNotFoundJson();

  const limited = await enforceHubDetailsRate(request);
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, source: { kind: 'cookie' }, mutation: true });
  if (!ctxResult.ok) return ctxResult.response;

  const stage = ctxResult.ctx.state.stage;
  if (stage !== 'requested' && stage !== 'designing' && stage !== 'review') {
    return hubJson({ ok: false, error: 'Not available in your preview.' }, 403);
  }

  try {
    const result = await ensureHubDraftShop(ctxResult.ctx.request.id);
    if (!result.ok) {
      if (result.code === 'NOT_FOUND') return hubNotFoundJson();
      return hubJson({ ok: false, error: 'Not available in your preview.' }, result.httpStatus);
    }
    return hubJson({ shopId: result.shopId });
  } catch (error) {
    console.error('[admin-hub] draft shop ensure failed', {
      error: error instanceof Error ? error.message : error,
    });
    return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  }
};
