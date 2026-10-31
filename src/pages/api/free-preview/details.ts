export const prerender = false;

import type { APIRoute } from 'astro';
import { isFreePreviewFlowEnabled } from '@/lib/freePreview/config';
import { parseFreePreviewDetails } from '@/lib/freePreview/intake';
import { savePreviewRequestDetails } from '@/lib/freePreview/savePreviewRequestDetails';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

export const FREE_PREVIEW_DETAILS_IP_RATE = {
  action: 'free_preview_details',
  limit: 10,
  windowMs: 60 * 60 * 1000,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Optional Step 2 details for a request just made on /free-preview. 404 while the flow is switched off. */
export const POST: APIRoute = async ({ request }) => {
  if (!isFreePreviewFlowEnabled()) {
    return json({ ok: false, error: 'Not found.' }, 404);
  }

  const limited = await enforceIpRateLimit(
    request,
    FREE_PREVIEW_DETAILS_IP_RATE.action,
    FREE_PREVIEW_DETAILS_IP_RATE.limit,
    FREE_PREVIEW_DETAILS_IP_RATE.windowMs,
  );
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request body.' }, 400);
  }

  const parsed = parseFreePreviewDetails(body);
  if (!parsed.ok) {
    return json({ ok: false, error: 'Please check your answers.', fieldErrors: parsed.fieldErrors }, 400);
  }

  try {
    const result = await savePreviewRequestDetails(parsed.value);
    if (!result.ok) {
      return json({ ok: false, code: result.code, error: 'This form has expired.' }, result.httpStatus);
    }
    return json({ ok: true });
  } catch (error) {
    console.error('[free-preview] details save failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: 'We could not save your details. Please try again shortly.' }, 500);
  }
};
