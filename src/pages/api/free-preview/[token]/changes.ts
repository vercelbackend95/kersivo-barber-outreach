export const prerender = false;

import type { APIRoute } from 'astro';
import { PREVIEW_CHANGES_RATE, previewApiGuard, previewJson } from '@/lib/freePreview/previewApi';
import { previewChangesSchema, requestPreviewChanges } from '@/lib/freePreview/requestChanges';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

/** "Request changes" from the private preview (spec §6). */
export const POST: APIRoute = async ({ request, params }) => {
  const blocked = previewApiGuard(request);
  if (blocked) return blocked;

  const limited = await enforceIpRateLimit(
    request,
    PREVIEW_CHANGES_RATE.action,
    PREVIEW_CHANGES_RATE.limit,
    PREVIEW_CHANGES_RATE.windowMs,
  );
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return previewJson({ ok: false, error: 'Invalid request body.' }, 400);
  }
  const parsed = previewChangesSchema.safeParse(body);
  if (!parsed.success) {
    return previewJson({ ok: false, error: 'Tell us what you would like to change (up to 2,000 characters).' }, 400);
  }

  try {
    const result = await requestPreviewChanges({ token: params.token ?? '', changes: parsed.data.changes });
    if (!result.ok) {
      return result.code === 'NOT_FOUND'
        ? previewJson({ ok: false, error: 'Not found.' }, 404)
        : previewJson({ ok: false, error: 'This preview is no longer available.', code: result.code }, result.httpStatus);
    }
    return previewJson({ ok: true });
  } catch (error) {
    console.error('[free-preview] request changes failed', error instanceof Error ? error.message : error);
    return previewJson({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  }
};
