export const prerender = false;

import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import {
  enforceHubChangesRate,
  hubJson,
  requireDraftChangesCapability,
  resolveHubApiContext,
} from '@/lib/freePreview/hubApi';
import {
  assertChangeAttachment,
  createHubChangeDraft,
  hubChangeDraftSchema,
  loadHubChanges,
} from '@/lib/freePreview/hubChanges';
import { tokenPrefixForLog } from '@/lib/freePreview/hubPage';

export const GET: APIRoute = async ({ request, params }) => {
  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: false });
  if (!ctxResult.ok) return ctxResult.response;
  const items = await loadHubChanges(ctxResult.ctx.request.id);
  return hubJson({
    ok: true,
    items,
    includedChangeRounds: ctxResult.ctx.request.includedChangeRounds,
    changeRoundsUsed: ctxResult.ctx.request.changeRoundsUsed,
    canSend: ctxResult.ctx.state.capabilities.canSendChanges,
  });
};

export const POST: APIRoute = async ({ request, params }) => {
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

  try {
    const item = await createHubChangeDraft({
      previewRequestId: ctxResult.ctx.request.id,
      page: parsed.data.page,
      body: parsed.data.body,
      attachmentId: parsed.data.attachmentId,
    });
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: ctxResult.ctx.request.id,
        action: PREVIEW_REQUEST_ACTIONS.HUB_CHANGE_DRAFTED,
        meta: { changeId: item.id, page: item.page },
      },
    });
    if (!ctxResult.ctx.isOperator) {
      await sendServerAnalyticsEvent({
        name: FUNNEL_EVENTS.hub_change_drafted,
        clientId: analyticsClientIdFromRequest(request),
      });
    }
    return hubJson({ ok: true, item }, 201);
  } catch (error) {
    console.error('[preview-hub] change draft failed', {
      token: tokenPrefixForLog(params.token ?? ''),
      error: error instanceof Error ? error.message : error,
    });
    return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  }
};
