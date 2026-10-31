export const prerender = false;

import type { APIRoute } from 'astro';
import { analyticsClientIdFromRequest, sendServerAnalyticsEvent } from '@/lib/analytics/serverEvents';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import {
  assertHubUploadCaps,
  HUB_MAX_BODY_BYTES,
  loadActiveHubAssets,
  processHubUpload,
  serializeHubAsset,
  storeProcessedHubFile,
} from '@/lib/freePreview/hubAssets';
import {
  enforceHubAssetRates,
  hubJson,
  parseHubAssetKind,
  rejectOversizedHubBody,
  requireUploadCapability,
  resolveHubApiContext,
} from '@/lib/freePreview/hubApi';
import { maybeNotifyOpsOfHubFiles } from '@/lib/freePreview/hubFilesNotify';
import { HUB_UPLOAD_ERROR_EMPTY, HUB_UPLOAD_ERROR_TYPE } from '@/lib/freePreview/hubCopy';

export const GET: APIRoute = async ({ request, params }) => {
  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: false });
  if (!ctxResult.ok) return ctxResult.response;
  const assets = await loadActiveHubAssets(ctxResult.ctx.request.id);
  return hubJson({ ok: true, assets: assets.map(serializeHubAsset) });
};

export const POST: APIRoute = async ({ request, params }) => {
  const oversized = rejectOversizedHubBody(request);
  if (oversized) return oversized;

  const limited = await enforceHubAssetRates(request, params.token ?? '');
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: true });
  if (!ctxResult.ok) return ctxResult.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return hubJson({ ok: false, error: 'Invalid request body.' }, 400);
  }

  const kind = parseHubAssetKind(form.get('kind'));
  if (!kind) return hubJson({ ok: false, error: HUB_UPLOAD_ERROR_TYPE }, 400);
  const denied = requireUploadCapability(ctxResult.ctx, kind);
  if (denied) return denied;

  const file = form.get('file');
  if (!(file instanceof File)) return hubJson({ ok: false, error: HUB_UPLOAD_ERROR_EMPTY }, 400);
  if (file.size <= 0) return hubJson({ ok: false, error: HUB_UPLOAD_ERROR_EMPTY }, 400);
  if (file.size > HUB_MAX_BODY_BYTES) {
    return hubJson({ ok: false, error: 'This file is over 4 MB. Try a smaller photo.' }, 413);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const processed = await processHubUpload({
    bytes,
    originalFileName: file.name,
    kind,
  });
  if (!processed.ok) return hubJson({ ok: false, error: processed.error }, 400);

  const caps = await assertHubUploadCaps({
    previewRequestId: ctxResult.ctx.request.id,
    kind,
    incomingBytes: processed.file.sizeBytes,
  });
  if (!caps.ok) return hubJson({ ok: false, error: caps.error }, 400);

  try {
    const row = await storeProcessedHubFile({
      requestId: ctxResult.ctx.request.id,
      file: processed.file,
      uploadedBy: ctxResult.ctx.isOperator ? 'KERSIVO' : 'OWNER',
    });
    await prisma.previewRequestEvent.create({
      data: {
        previewRequestId: ctxResult.ctx.request.id,
        action: PREVIEW_REQUEST_ACTIONS.HUB_ASSET_UPLOADED,
        meta: { kind, assetId: row.id },
      },
    });
    if (!ctxResult.ctx.isOperator) {
      await sendServerAnalyticsEvent({
        name: FUNNEL_EVENTS.hub_asset_uploaded,
        clientId: analyticsClientIdFromRequest(request),
        params: { kind },
      });
    }
    if (kind !== 'MESSAGE_ATTACHMENT') {
      await maybeNotifyOpsOfHubFiles({
        requestId: ctxResult.ctx.request.id,
        shopName: ctxResult.ctx.request.shopName,
      }).catch((error) => {
        console.error('[preview-hub] files digest failed', error instanceof Error ? error.message : error);
      });
    }
    return hubJson({ ok: true, asset: serializeHubAsset(row) }, 201);
  } catch (error) {
    console.error('[preview-hub] upload failed', {
      token: (params.token ?? '').slice(0, 6),
      error: error instanceof Error ? error.message : error,
    });
    return hubJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  }
};
