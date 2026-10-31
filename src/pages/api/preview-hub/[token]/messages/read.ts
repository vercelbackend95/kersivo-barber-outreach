export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import { hubJson, resolveHubApiContext } from '@/lib/freePreview/hubApi';
import { markKersivoMessagesReadByOwner } from '@/lib/freePreview/hubMessages';

export const POST: APIRoute = async ({ request, params }) => {
  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: true });
  if (!ctxResult.ok) return ctxResult.response;
  if (ctxResult.ctx.isOperator) return hubJson({ ok: true, marked: 0 });

  const marked = await markKersivoMessagesReadByOwner({ previewRequestId: ctxResult.ctx.request.id });
  if (marked > 0) {
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: ctxResult.ctx.request.id,
        action: PREVIEW_REQUEST_ACTIONS.HUB_MESSAGES_READ,
        meta: { marked },
      },
    });
  }
  return hubJson({ ok: true, marked });
};
