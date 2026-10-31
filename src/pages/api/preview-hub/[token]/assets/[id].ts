export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import { PREVIEW_REQUEST_ACTIONS } from '@/lib/freePreview/createPreviewRequest';
import {
  defaultHubBlobClient,
  hubAssetServePlan,
  serializeHubAsset,
  softDeleteHubAsset,
} from '@/lib/freePreview/hubAssets';
import { hubAssetPatchSchema } from '@/lib/freePreview/hubDetails';
import {
  enforceHubAssetGetRate,
  enforceHubAssetRates,
  hubJson,
  hubNotFoundJson,
  requireUploadCapability,
  resolveHubApiContext,
} from '@/lib/freePreview/hubApi';

function assetHeaders(plan: ReturnType<typeof hubAssetServePlan>, fileName: string): Headers {
  const headers = new Headers();
  headers.set('Content-Type', plan.contentType);
  headers.set('Cache-Control', plan.cache);
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Referrer-Policy', 'no-referrer');
  const safeName = fileName.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 160) || 'file';
  const disposition = plan.disposition === 'attachment' ? 'attachment' : 'inline';
  headers.set('Content-Disposition', `${disposition}; filename="${safeName}"`);
  return headers;
}

export const GET: APIRoute = async ({ request, params }) => {
  const limited = await enforceHubAssetGetRate(request);
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: false });
  if (!ctxResult.ok) return ctxResult.response;

  const assetId = (params.id ?? '').trim();
  if (!assetId) return hubNotFoundJson();

  const size = new URL(request.url).searchParams.get('size') === 'full' ? 'full' : 'thumb';
  const row = await prisma.previewHubAsset.findFirst({
    where: { id: assetId, previewRequestId: ctxResult.ctx.request.id, deletedAt: null },
  });
  if (!row) return hubNotFoundJson();

  const path = size === 'thumb' ? row.thumbPath || row.storagePath : row.storagePath;
  if (!path) return hubNotFoundJson();

  try {
    const blob = await defaultHubBlobClient.get(path);
    if (!blob.stream || blob.statusCode !== 200) return hubNotFoundJson();
    const contentType =
      size === 'thumb' && row.thumbPath
        ? row.thumbPath.endsWith('.png')
          ? 'image/png'
          : 'image/webp'
        : row.contentType;
    const plan = hubAssetServePlan({
      size,
      contentType,
      sniffedExt: row.storagePath.split('.').pop(),
    });
    return new Response(blob.stream, {
      status: 200,
      headers: assetHeaders(plan, row.originalFileName),
    });
  } catch (error) {
    console.error('[preview-hub] asset stream failed', {
      token: (params.token ?? '').slice(0, 6),
      error: error instanceof Error ? error.message : error,
    });
    return hubNotFoundJson();
  }
};

export const PATCH: APIRoute = async ({ request, params }) => {
  const limited = await enforceHubAssetRates(request, params.token ?? '');
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: true });
  if (!ctxResult.ok) return ctxResult.response;
  const denied = requireUploadCapability(ctxResult.ctx);
  if (denied) return denied;

  const assetId = (params.id ?? '').trim();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return hubJson({ ok: false, error: 'Invalid request body.' }, 400);
  }
  const parsed = hubAssetPatchSchema.safeParse(body);
  if (!parsed.success) return hubJson({ ok: false, error: 'Invalid request body.' }, 400);

  const existing = await prisma.previewHubAsset.findFirst({
    where: {
      id: assetId,
      previewRequestId: ctxResult.ctx.request.id,
      deletedAt: null,
      uploadedBy: 'OWNER',
    },
  });
  if (!existing) return hubNotFoundJson();

  const data: { caption?: string | null; sortOrder?: number; barberId?: string | null } = {};
  if (parsed.data.caption !== undefined) data.caption = parsed.data.caption;
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
  if (parsed.data.barberId !== undefined) data.barberId = parsed.data.barberId;

  const row = await prisma.previewHubAsset.update({
    where: { id: existing.id },
    data,
  });
  await prisma.previewRequestEvent.create({
    data: {
      previewRequestId: ctxResult.ctx.request.id,
      action: PREVIEW_REQUEST_ACTIONS.HUB_ASSET_UPDATED,
      meta: { assetId: row.id, fields: Object.keys(data) },
    },
  });
  return hubJson({ ok: true, asset: serializeHubAsset(row) });
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const limited = await enforceHubAssetRates(request, params.token ?? '');
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, token: params.token ?? '', mutation: true });
  if (!ctxResult.ok) return ctxResult.response;
  const denied = requireUploadCapability(ctxResult.ctx);
  if (denied) return denied;

  const assetId = (params.id ?? '').trim();
  const existing = await prisma.previewHubAsset.findFirst({
    where: {
      id: assetId,
      previewRequestId: ctxResult.ctx.request.id,
      deletedAt: null,
      uploadedBy: 'OWNER',
    },
    select: { id: true },
  });
  if (!existing) return hubNotFoundJson();

  const deleted = await softDeleteHubAsset({
    assetId: existing.id,
    previewRequestId: ctxResult.ctx.request.id,
  });
  if (!deleted) return hubNotFoundJson();
  await prisma.previewRequestEvent.create({
    data: {
      previewRequestId: ctxResult.ctx.request.id,
      action: PREVIEW_REQUEST_ACTIONS.HUB_ASSET_DELETED,
      meta: { assetId: existing.id },
    },
  });
  return hubJson({ ok: true });
};
