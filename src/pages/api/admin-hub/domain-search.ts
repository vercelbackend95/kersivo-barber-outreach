export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { searchDomains } from '@/lib/domains/search';
import { hubJson, hubNotFoundJson, resolveHubApiContext } from '@/lib/freePreview/hubApi';
import { isAdminHubRouteEnabled } from '@/lib/freePreview/hubPage';
import { PREVIEW_DOMAIN_SEARCH_RATE } from '@/lib/freePreview/previewApi';
import { ownerCanActOnPreview } from '@/lib/freePreview/previewAccess';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

const bodySchema = z.object({
  query: z.string().trim().max(63).optional().default(''),
});

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminHubRouteEnabled()) return hubNotFoundJson();

  const limited = await enforceIpRateLimit(
    request,
    PREVIEW_DOMAIN_SEARCH_RATE.action,
    PREVIEW_DOMAIN_SEARCH_RATE.limit,
    PREVIEW_DOMAIN_SEARCH_RATE.windowMs,
  );
  if (limited) return limited;

  const ctxResult = await resolveHubApiContext({ request, source: { kind: 'cookie' }, mutation: true });
  if (!ctxResult.ok) return ctxResult.response;
  const preview = ctxResult.ctx.request;
  if (!ownerCanActOnPreview(preview, new Date())) {
    return hubJson({ ok: false, error: 'This preview is no longer available.' }, 409);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return hubJson({ ok: false, error: 'Invalid request body.' }, 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return hubJson({ ok: false, error: 'Enter a shorter search.' }, 400);

  try {
    const result = await searchDomains({
      shopName: preview.shopName,
      townCity: preview.townCity,
      query: parsed.data.query,
    });
    return hubJson({ ok: true, ...result });
  } catch (error) {
    console.error('[admin-hub] domain search failed', error instanceof Error ? error.message : error);
    return hubJson({ ok: false, error: 'Unable to check domains just now.' }, 500);
  }
};
