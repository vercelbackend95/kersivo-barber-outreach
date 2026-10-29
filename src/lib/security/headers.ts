/**
 * Central security response headers (H07).
 * CSP is pragmatic for Astro + Stripe (allows unsafe-inline); tighten with nonces later.
 */

/**
 * Internal response header: a route may name ONE extra https origin it frames (the free preview frames the
 * shop's externally hosted website). Validated, added to frame-src, and stripped before the response leaves.
 */
export const EXTRA_FRAME_SRC_HEADER = 'X-Kersivo-Frame-Src';

function httpsOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname ? url.origin : null;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(options?: { extraFrameSrc?: string | null }): string {
  const extraFrameSrc = httpsOrigin(options?.extraFrameSrc ?? null);
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://googleads.g.doubleclick.net https://www.googleadservices.com https://www.google.com",
    `frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.google.com${extraFrameSrc ? ` ${extraFrameSrc}` : ''}`,
    "connect-src 'self' https://api.stripe.com https://*.openai.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://www.google.com https://googleads.g.doubleclick.net https://stats.g.doubleclick.net https://ad.doubleclick.net https://www.googleadservices.com https://pagead2.googlesyndication.com",
  ].join('; ');
}

export function applySecurityHeaders(
  response: Response,
  options?: { isProd?: boolean; isHttps?: boolean },
): Response {
  const headers = new Headers(response.headers);
  const isProd = options?.isProd ?? import.meta.env.PROD;
  const isHttps = options?.isHttps ?? isProd;

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  // A route may only make the referrer policy stricter (private token URLs use no-referrer).
  if (headers.get('Referrer-Policy') !== 'no-referrer') {
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)',
  );
  const extraFrameSrc = headers.get(EXTRA_FRAME_SRC_HEADER);
  headers.delete(EXTRA_FRAME_SRC_HEADER);
  headers.set('Content-Security-Policy', buildContentSecurityPolicy({ extraFrameSrc }));

  if (isHttps) {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
