export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import { isHubRouteEnabled } from '@/lib/freePreview/hubPage';
import { hubChangeStatusSchema, loadHubChanges, setHubChangeStatus } from '@/lib/freePreview/hubChanges';
import { HUB_OPS_CHANGE_NOTE } from '@/lib/freePreview/hubCopy';
import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';
import { z } from 'zod';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

const opsChangeSchema = hubChangeStatusSchema.extend({
  changeId: z.string().trim().min(1).max(64),
});

export const GET: APIRoute = async (context) => {
  if (!isHubRouteEnabled()) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  const requestId = (context.params.id ?? '').trim();
  if (!requestId || requestId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const request = await prisma.previewRequest.findUnique({
    where: { id: requestId },
    select: { id: true, anonymisedAt: true, includedChangeRounds: true, changeRoundsUsed: true },
  });
  if (!request || request.anonymisedAt) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const items = await loadHubChanges(request.id);
  return json({
    ok: true,
    items,
    includedChangeRounds: request.includedChangeRounds,
    changeRoundsUsed: request.changeRoundsUsed,
  });
};

export const POST: APIRoute = async (context) => {
  if (!isHubRouteEnabled()) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  const requestId = (context.params.id ?? '').trim();
  if (!requestId || requestId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const request = await prisma.previewRequest.findUnique({
    where: { id: requestId },
    select: { id: true, anonymisedAt: true },
  });
  if (!request || request.anonymisedAt) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);
  }
  const parsed = opsChangeSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);
  if (parsed.data.status === 'NOT_POSSIBLE' && !parsed.data.opsNote?.trim()) {
    return json({ ok: false, error: { code: 'NOTE_REQUIRED', message: HUB_OPS_CHANGE_NOTE } }, 400);
  }

  const item = await setHubChangeStatus({
    previewRequestId: request.id,
    changeId: parsed.data.changeId,
    status: parsed.data.status,
    opsNote: parsed.data.opsNote,
  });
  if (!item) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  await prisma.previewRequestEvent.create({
    data: {
      previewRequestId: request.id,
      action: PREVIEW_REQUEST_ACTIONS.OPS_HUB_CHANGE_STATUS,
      actorEmail: access.email,
      meta: { changeId: item.id, status: item.status },
    },
  });
  return json({ ok: true, item });
};
