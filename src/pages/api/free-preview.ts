export const prerender = false;

import { createHash } from 'node:crypto';
import type { APIRoute } from 'astro';
import { isFreePreviewFlowEnabled } from '@/lib/freePreview/config';
import { createPreviewRequest } from '@/lib/freePreview/createPreviewRequest';
import { parseFreePreviewRequest } from '@/lib/freePreview/intake';
import { isPreviewHubRealQaEnabled } from '@/lib/previewHub/realQa';
import { checkDurableRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit/durableRateLimit';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';

export const FREE_PREVIEW_IP_RATE = { action: 'free_preview_request', limit: 5, windowMs: 60 * 60 * 1000 };
export const FREE_PREVIEW_EMAIL_RATE = {
  action: 'free_preview_request_email',
  limit: 3,
  windowMs: 24 * 60 * 60 * 1000,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Rate-limit bucket for an email without storing the address itself. */
function emailBucketKey(email: string): string {
  return `email:${createHash('sha256').update(email).digest('hex')}`;
}

/** Public free-preview intake (docs/free-preview-spec.md §5). 404 while the flow is switched off. */
export const POST: APIRoute = async ({ request }) => {
  if (!isFreePreviewFlowEnabled()) {
    return json({ ok: false, error: 'Not found.' }, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request body.' }, 400);
  }
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid request body.' }, 400);
  }

  // Honeypot first — bots fill hidden fields; silent accept without burning rate limit or sending mail.
  const companyWebsite = (body as Record<string, unknown>).companyWebsite;
  if (typeof companyWebsite === 'string' && companyWebsite.trim()) {
    return json({ ok: true });
  }

  const skipRates = isPreviewHubRealQaEnabled();
  const limited = skipRates
    ? null
    : await enforceIpRateLimit(
        request,
        FREE_PREVIEW_IP_RATE.action,
        FREE_PREVIEW_IP_RATE.limit,
        FREE_PREVIEW_IP_RATE.windowMs,
      );
  if (limited) return limited;

  const parsed = parseFreePreviewRequest(body);
  if (!parsed.ok) {
    return json(
      { ok: false, error: 'Please check the highlighted fields.', fieldErrors: parsed.fieldErrors },
      400,
    );
  }

  if (!skipRates) {
    const emailLimit = await checkDurableRateLimit({
      key: emailBucketKey(parsed.value.email),
      action: FREE_PREVIEW_EMAIL_RATE.action,
      limit: FREE_PREVIEW_EMAIL_RATE.limit,
      windowMs: FREE_PREVIEW_EMAIL_RATE.windowMs,
    });
    if (!emailLimit.ok) return rateLimitExceededResponse(emailLimit.retryAfterSeconds);
  }

  let overDailyCap: boolean;
  let leadToken: string;
  try {
    ({ overDailyCap, leadToken } = await createPreviewRequest(parsed.value));
  } catch (error) {
    console.error('[free-preview] request create failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: 'We could not save your request. Please try again shortly.' }, 500);
  }

  return json(overDailyCap ? { ok: true, overDailyCap: true, leadToken } : { ok: true, leadToken });
};
