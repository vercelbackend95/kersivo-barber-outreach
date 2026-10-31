export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import {
  enforceHubChangesRate,
  hubJson,
  hubNotFoundJson,
  requireDraftChangesCapability,
  resolveHubApiContext,
} from '@/lib/freePreview/hubApi';
import {
  assertChangeAttachment,
  deleteHubChangeDraft,
  hubChangeDraftSchema,
  updateHubChangeDraft,
} from '@/lib/freePreview/hubChanges';
import { tokenPrefixForLog } from '@/lib/freePreview/hubPage';

export const PATCH: APIRoute = async ({ request, params }) => {
  const limited = await enforceHubChangesRate(request);
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: true });
  if (!ctxResult.ok) return ctxResult.response;
  const denied = requireDraftChangesCapability(ctxResult.ctx);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return hubJson({ ok: false, error: 'Invalid request body.' }, 400);
  }
  const parsed = hubChangeDraftSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Invalid request body.';
    return hubJson({ ok: false, error: first }, 400);
  }
  const attachment = await assertChangeAttachment({
    previewRequestId: ctxResult.ctx.request.id,
    attachmentId: parsed.data.attachmentId,
  });
  if (!attachment.ok) return hubJson({ ok: false, error: attachment.error }, 400);

  const item = await updateHubChangeDraft({
    previewRequestId: ctxResult.ctx.request.id,
    changeId: params.id ?? '',
    page: parsed.data.page,
    body: parsed.data.body,
    attachmentId: parsed.data.attachmentId,
  });
  if (!item) return hubNotFoundJson();
  await prisma.previewRequestEvent.create({
    data: {
      previewRequestId: ctxResult.ctx.request.id,
      action: PREVIEW_REQUEST_ACTIONS.HUB_CHANGE_UPDATED,
      meta: { changeId: item.id },
    },
  });
  return hubJson({ ok: true, item });
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const limited = await enforceHubChangesRate(request);
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: true });
  if (!ctxResult.ok) return ctxResult.response;
  const denied = requireDraftChangesCapability(ctxResult.ctx);
  if (denied) return denied;

  const deleted = await deleteHubChangeDraft({
    previewRequestId: ctxResult.ctx.request.id,
    changeId: params.id ?? '',
  });
  if (!deleted) return hubNotFoundJson();
  await prisma.previewRequestEvent.create({
    data: {
      previewRequestId: ctxResult.ctx.request.id,
      action: PREVIEW_REQUEST_ACTIONS.HUB_CHANGE_DELETED,
      meta: { changeId: params.id },
    },
  });
  console.info('[preview-hub] change deleted', { token: tokenPrefixForLog(params.token ?? '') });
  return hubJson({ ok: true });
};
