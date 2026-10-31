export const prerender = false;

import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import {
  enforceHubMessageRates,
  hubJson,
  requireMessageCapability,
  resolveHubApiContext,
} from '@/lib/freePreview/hubApi';
import {
  assertMessageAttachments,
  createHubMessage,
  hubMessagePostSchema,
  loadHubMessages,
} from '@/lib/freePreview/hubMessages';
import { maybeNotifyOpsOfHubMessages, notifyOwnerOfKersivoMessage } from '@/lib/freePreview/hubMessagesNotify';
import { tokenPrefixForLog } from '@/lib/freePreview/hubPage';

export const GET: APIRoute = async ({ request, params }) => {
  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: false });
  if (!ctxResult.ok) return ctxResult.response;
  const messages = await loadHubMessages(ctxResult.ctx.request.id);
  return hubJson({ ok: true, messages });
};

export const POST: APIRoute = async ({ request, params }) => {
  const limited = await enforceHubMessageRates(request, params.token ?? '');
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: true });
  if (!ctxResult.ok) return ctxResult.response;
  const denied = requireMessageCapability(ctxResult.ctx);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return hubJson({ ok: false, error: 'Invalid request body.' }, 400);
  }
  const parsed = hubMessagePostSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Invalid request body.';
    return hubJson({ ok: false, error: first }, 400);
  }

  const attachmentIds = parsed.data.attachmentIds ?? [];
  const attachments = await assertMessageAttachments({
    previewRequestId: ctxResult.ctx.request.id,
    attachmentIds,
  });
  if (!attachments.ok) return hubJson({ ok: false, error: attachments.error }, 400);

  try {
    const author = ctxResult.ctx.isOperator ? 'KERSIVO' : 'OWNER';
    const message = await createHubMessage({
      previewRequestId: ctxResult.ctx.request.id,
      author,
      body: parsed.data.body,
      attachmentIds,
    });
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: ctxResult.ctx.request.id,
        action: PREVIEW_REQUEST_ACTIONS.HUB_MESSAGE_SENT,
        meta: { actor: author === 'OWNER' ? 'owner' : 'kersivo', messageId: message.id },
      },
    });
    if (!ctxResult.ctx.isOperator) {
      await sendServerAnalyticsEvent({
        name: FUNNEL_EVENTS.hub_message_sent,
        clientId: analyticsClientIdFromRequest(request),
        params: { actor: 'owner' },
      });
      await maybeNotifyOpsOfHubMessages({
        requestId: ctxResult.ctx.request.id,
        shopName: ctxResult.ctx.request.shopName,
      }).catch((error) => {
        console.error('[preview-hub] messages digest failed', error instanceof Error ? error.message : error);
      });
    } else {
      await notifyOwnerOfKersivoMessage({
        requestId: ctxResult.ctx.request.id,
        to: ctxResult.ctx.request.email,
        firstName: ctxResult.ctx.request.firstName,
        shopName: ctxResult.ctx.request.shopName,
        publicToken: ctxResult.ctx.request.publicToken,
        body: parsed.data.body,
        messageId: message.id,
      }).catch((error) => {
        console.error('[preview-hub] owner message email failed', error instanceof Error ? error.message : error);
      });
    }
    return hubJson({ ok: true, message }, 201);
  } catch (error) {
    console.error('[preview-hub] message send failed', {
      token: tokenPrefixForLog(params.token ?? ''),
      error: error instanceof Error ? error.message : error,
    });
    return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  }
};
