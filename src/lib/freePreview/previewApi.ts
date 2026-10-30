import { isFreePreviewFlowEnabled } from './config';

export const PREVIEW_API_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
} as const;

export function previewJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: PREVIEW_API_HEADERS });
}

/**
 * Shared guards for /api/free-preview/{token}/*: 404 while the flow is off, and a same-origin check on
 * browser POSTs (the token is the capability; this only stops other sites from driving the form).
 */
export function previewApiGuard(request: Request): Response | null {
  if (!isFreePreviewFlowEnabled()) return previewJson({ ok: false, error: 'Not found.' }, 404);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return previewJson({ ok: false, error: 'Forbidden.' }, 403);
  }
  return null;
}

/** IP limits for the token endpoints: generous for an owner, useless for guessing 256-bit tokens. */
export const PREVIEW_CHANGES_RATE = { action: 'free_preview_changes', limit: 10, windowMs: 60 * 60 * 1000 };
export const PREVIEW_CHECKOUT_RATE = { action: 'free_preview_checkout', limit: 10, windowMs: 15 * 60 * 1000 };
export const PREVIEW_EVENT_RATE = { action: 'free_preview_event', limit: 30, windowMs: 60 * 60 * 1000 };
/** Typeahead after ~150ms debounce — generous for an owner, useless for guessing tokens. */
export const PREVIEW_DOMAIN_SEARCH_RATE = { action: 'free_preview_domain_search', limit: 40, windowMs: 10 * 60 * 1000 };
export const PREVIEW_NO_THANKS_RATE = { action: 'free_preview_no_thanks', limit: 30, windowMs: 60 * 60 * 1000 };
export const PREVIEW_PAGE_RATE = { action: 'free_preview_view', limit: 120, windowMs: 60 * 60 * 1000 };
