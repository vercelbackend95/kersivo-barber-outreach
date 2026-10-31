export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import { isHubRouteEnabled } from '@/lib/freePreview/hubPage';
import {
  assertMessageAttachments,
  createHubMessage,
  hubMessagePostSchema,
  loadHubMessages,
  markOwnerMessagesReadByOps,
} from '@/lib/freePreview/hubMessages';
import { notifyOwnerOfKersivoMessage } from '@/lib/freePreview/hubMessagesNotify';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';
import { requireOperatorMutation } from '@/lib/ops/requireOperatorMutation';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

export const GET: APIRoute = async (context) => {
  if (!isHubRouteEnabled()) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  const requestId = (context.params.id ?? '').trim();
  if (!requestId || requestId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  const request = await prisma.previewRequest.findUnique({
    where: { id: requestId },
    select: { id: true, anonymisedAt: true },
  });
  if (!request || request.anonymisedAt) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  const marked = await markOwnerMessagesReadByOps({ previewRequestId: request.id });
  if (marked > 0) {
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: request.id,
        action: PREVIEW_REQUEST_ACTIONS.OPS_HUB_MESSAGES_READ,
        actorEmail: access.email,
        meta: { marked },
      },
    });
  }

  const messages = await loadHubMessages(request.id);
  return json({ ok: true, messages, marked });
};

export const POST: APIRoute = async (context) => {
  if (!isHubRouteEnabled()) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  const access = await requireOperatorMutation(context);
  if (access instanceof Response) return access;

  const requestId = (context.params.id ?? '').trim();
  if (!requestId || requestId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  const request = await prisma.previewRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      anonymisedAt: true,
      email: true,
      firstName: true,
      shopName: true,
      publicToken: true,
    },
  });
  if (!request || request.anonymisedAt) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);
  }
  const parsed = hubMessagePostSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);

  const attachmentIds = parsed.data.attachmentIds ?? [];
  const attachments = await assertMessageAttachments({
    previewRequestId: request.id,
    attachmentIds,
  });
  if (!attachments.ok) return json({ ok: false, error: { code: 'INVALID_BODY' } }, 400);

  try {
    const message = await createHubMessage({
      previewRequestId: request.id,
      author: 'KERSIVO',
      authorEmail: access.email,
      body: parsed.data.body,
      attachmentIds,
    });
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: request.id,
        action: PREVIEW_REQUEST_ACTIONS.OPS_HUB_MESSAGE_SENT,
        actorEmail: access.email,
        meta: { actor: 'kersivo', messageId: message.id },
      },
    });
    await notifyOwnerOfKersivoMessage({
      requestId: request.id,
      to: request.email,
      firstName: request.firstName,
      shopName: request.shopName,
      publicToken: request.publicToken,
      body: parsed.data.body,
      messageId: message.id,
    }).catch((error) => {
      console.error('[ops/preview-hub-messages] owner email failed', error instanceof Error ? error.message : error);
    });
    return json({ ok: true, message }, 201);
  } catch (error) {
    console.error('[ops/preview-hub-messages] send failed', {
      id: requestId,
      error: error instanceof Error ? error.message : error,
    });
    return json({ ok: false, error: { code: 'INTERNAL_ERROR' } }, 500);
  }
};
