export const prerender = false;

import type { APIRoute } from 'astro';
import { unlockBrandColours } from '@/lib/adminHub/brandLock';
import { isAnyHubRouteEnabled } from '@/lib/freePreview/hubPage';
import { OPS_API_HEADERS } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

export const POST: APIRoute = async (context) => {
  if (!isAnyHubRouteEnabled()) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  const requestId = (context.params.id ?? '').trim();
  if (!requestId || requestId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  const result = await unlockBrandColours({
    requestId,
    actorEmail: access.email,
  });
  if (!result.ok) return json({ ok: false, error: { code: result.code } }, 404);
  return json({ ok: true, wasLocked: result.wasLocked, submittedAt: result.submittedAt });
};
