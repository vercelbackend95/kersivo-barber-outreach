import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import {
  enforceHubChangesRate,
  hubJson,
  hubLogRef,
  hubNotFoundJson,
  requireDraftChangesCapability,
  requireSendChangesCapability,
  resolveHubApiContext,
  type HubSourceOf,
} from '@/lib/freePreview/hubApi';
import {
  assertChangeAttachment,
  createHubChangeDraft,
  deleteHubChangeDraft,
  hubChangeDraftSchema,
  loadHubChanges,
  sendHubChanges,
  updateHubChangeDraft,
} from '@/lib/freePreview/hubChanges';

export function createHubChangesHandlers(sourceOf: HubSourceOf): { GET: APIRoute; POST: APIRoute } {
  const GET: APIRoute = async ({ request, params }) => {
    const ctxResult = await resolveHubApiContext({ request, source: sourceOf(params), mutation: false });
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

  const POST: APIRoute = async ({ request, params }) => {
    const source = sourceOf(params);
    const limited = await enforceHubChangesRate(request);
    if (limited) return limited;

    const ctxResult = await resolveHubApiContext({ request, source, mutation: true });
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
        token: hubLogRef(source),
        error: error instanceof Error ? error.message : error,
      });
      return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
    }
  };

  return { GET, POST };
}

export function createHubChangeByIdHandlers(sourceOf: HubSourceOf): { PATCH: APIRoute; DELETE: APIRoute } {
  const PATCH: APIRoute = async ({ request, params }) => {
    const limited = await enforceHubChangesRate(request);
    if (limited) return limited;

    const ctxResult = await resolveHubApiContext({ request, source: sourceOf(params), mutation: true });
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

  const DELETE: APIRoute = async ({ request, params }) => {
    const source = sourceOf(params);
    const limited = await enforceHubChangesRate(request);
    if (limited) return limited;

    const ctxResult = await resolveHubApiContext({ request, source, mutation: true });
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
    console.info('[preview-hub] change deleted', { token: hubLogRef(source) });
    return hubJson({ ok: true });
  };

  return { PATCH, DELETE };
}

export function createHubChangesSendHandlers(sourceOf: HubSourceOf): { POST: APIRoute } {
  const POST: APIRoute = async ({ request, params }) => {
    const source = sourceOf(params);
    const limited = await enforceHubChangesRate(request);
    if (limited) return limited;

    const ctxResult = await resolveHubApiContext({ request, source, mutation: true });
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
        token: hubLogRef(source),
        error: error instanceof Error ? error.message : error,
      });
      return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
    }
  };

  return { POST };
}
