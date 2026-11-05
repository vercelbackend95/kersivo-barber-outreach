export const prerender = false;

/**
 * GET /api/ops/preview-requests/[id]/remote-image?ref=<source:ownerId>&w=96|240
 * A small WebP thumbnail of one dashboard image in the build pack, for the ops Overview. The image URL
 * is looked up on the request's draft shop (never read from the query) and fetched under the same
 * allowlist and limits as the zip (buildPackRemoteImageThumb.ts). Operators only.
 */
import type { APIRoute } from 'astro';
import {
  buildRemoteImageThumb,
  parseRemoteImageRef,
  parseThumbWidth,
} from '@/lib/ops/buildPackRemoteImageThumb';
import { OPS_API_HEADERS, requireOperatorAccess } from '@/lib/ops/operatorAuth';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...OPS_API_HEADERS } });
}

export const GET: APIRoute = async (context) => {
  const access = await requireOperatorAccess(context);
  if (access instanceof Response) return access;

  const requestId = (context.params.id ?? '').trim();
  const params = new URL(context.request.url).searchParams;
  const ref = parseRemoteImageRef(params.get('ref'));
  const width = parseThumbWidth(params.get('w'));
  if (!requestId || requestId.length > 64) return json({ ok: false, error: { code: 'NOT_FOUND' } }, 404);
  if (!ref || !width) return json({ ok: false, error: { code: 'BAD_REQUEST' } }, 400);

  try {
    const result = await buildRemoteImageThumb(requestId, ref, width);
    if (!result.ok) {
      const code = result.status === 410 ? 'GONE' : result.status === 404 ? 'NOT_FOUND' : 'IMAGE_UNAVAILABLE';
      return json({ ok: false, error: { code } }, result.status);
    }
    return new Response(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'private, max-age=3600',
        Vary: 'Cookie',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[ops/remote-image] failed', error instanceof Error ? error.message : error);
    return json({ ok: false, error: { code: 'INTERNAL_ERROR' } }, 500);
  }
};
