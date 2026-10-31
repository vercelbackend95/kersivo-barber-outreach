export const prerender = false;

import type { APIRoute } from 'astro';
import { prisma } from '@/lib/db/client';
import { defaultHubBlobClient, hubAssetServePlan } from '@/lib/freePreview/hubAssets';
import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

export const GET: APIRoute = async (context) => {
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  const requestId = (context.params.id ?? '').trim();
  const assetId = (context.params.assetId ?? '').trim();
  if (!requestId || !assetId) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  const row = await prisma.previewHubAsset.findFirst({
    where: { id: assetId, previewRequestId: requestId, deletedAt: null },
  });
  if (!row) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  const size = new URL(context.request.url).searchParams.get('size') === 'thumb' ? 'thumb' : 'full';
  const path = size === 'thumb' ? row.thumbPath || row.storagePath : row.storagePath;
  if (!path) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);

  try {
    const blob = await defaultHubBlobClient.get(path);
    if (!blob.stream || blob.statusCode !== 200) {
      return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
    }
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
    const headers = new Headers();
    headers.set('Content-Type', plan.contentType);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    const safeName = row.originalFileName.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 160) || 'file';
    headers.set('Content-Disposition', `attachment; filename="${safeName}"`);
    return new Response(blob.stream, { status: 200, headers });
  } catch (error) {
    console.error('[ops/preview-hub-asset] stream failed', error instanceof Error ? error.message : error);
    return json({ ok: false, error: { code: 'INTERNAL_ERROR' } }, 500);
  }
};
