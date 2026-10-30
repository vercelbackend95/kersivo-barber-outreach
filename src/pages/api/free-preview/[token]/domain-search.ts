export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { searchDomains } from '@/lib/domains/search';
import { PREVIEW_DOMAIN_SEARCH_RATE, previewApiGuard, previewJson } from '@/lib/freePreview/previewApi';
import { ownerCanActOnPreview, resolvePreviewRequestByToken } from '@/lib/freePreview/previewAccess';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

const bodySchema = z.object({
  query: z.string().trim().max(63).optional().default(''),
});

/** Live availability for the preview launch searcher. Token is the capability. */
export const POST: APIRoute = async ({ request, params }) => {
  const blocked = previewApiGuard(request);
  if (blocked) return blocked;

  const limited = await enforceIpRateLimit(
    request,
    PREVIEW_DOMAIN_SEARCH_RATE.action,
    PREVIEW_DOMAIN_SEARCH_RATE.limit,
    PREVIEW_DOMAIN_SEARCH_RATE.windowMs,
  );
  if (limited) return limited;

  const preview = await resolvePreviewRequestByToken(params.token ?? '');
  if (!preview) return previewJson({ ok: false, error: 'Not found.' }, 404);
  if (!ownerCanActOnPreview(preview, new Date())) {
    return previewJson({ ok: false, error: 'This preview is no longer available.' }, 409);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return previewJson({ ok: false, error: 'Invalid request body.' }, 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return previewJson({ ok: false, error: 'Enter a shorter search.' }, 400);

  try {
    const result = await searchDomains({
      shopName: preview.shopName,
      townCity: preview.townCity,
      query: parsed.data.query,
    });
    return previewJson({ ok: true, ...result });
  } catch (error) {
    console.error('[free-preview] domain search failed', error instanceof Error ? error.message : error);
    return previewJson({ ok: false, error: 'Unable to check domains just now.' }, 500);
  }
};
