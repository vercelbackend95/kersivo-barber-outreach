export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import { grantHubChangeRound } from '@/lib/freePreview/hubChanges';
import { isHubRouteEnabled } from '@/lib/freePreview/hubPage';
import { OPS_API_HEADERS } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

export const POST: APIRoute = async (context) => {
  if (!isHubRouteEnabled()) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  const requestId = (context.params.id ?? '').trim();
  if (!requestId || requestId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  const result = await grantHubChangeRound({ previewRequestId: requestId });
  if (!result) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  await prisma.previewRequestEvent.create({
    data: {
      previewRequestId: requestId,
      action: PREVIEW_REQUEST_ACTIONS.OPS_HUB_ROUND_GRANTED,
      actorEmail: access.email,
      meta: { includedChangeRounds: result.includedChangeRounds },
    },
  });
  return json({ ok: true, ...result });
};
