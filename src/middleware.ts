import { defineMiddleware } from 'astro:middleware';
import { DEMO_ACTION_BLOCKED_MESSAGE, DEMO_ADMIN_MODE_HEADER } from '@/lib/admin/demoConfig';
import { applySecurityHeaders } from '@/lib/security/headers';
import {
  SAFE_METHODS,
  evaluateOriginGate,
  parseAllowedOrigins,
} from '@/lib/security/origin';

const ADMIN_API_PREFIX = '/api/admin';

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;
  const method = request.method.toUpperCase();
  const isProd = import.meta.env.PROD;
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const isHttps = isProd || forwardedProto === 'https';

  // Resolve navbar CTA on the server only (never imported by components with client scripts).
  if (SAFE_METHODS.has(method) && !url.pathname.startsWith('/api/')) {
    try {
      const { resolveNavbarPreviewCta } = await import('@/lib/nav/navbarPreviewCta.server');
      context.locals.navbarPreviewCta = await resolveNavbarPreviewCta(context);
    } catch {
      context.locals.navbarPreviewCta = null;
    }
  }

  if (
    !SAFE_METHODS.has(method) &&
    url.pathname.startsWith(ADMIN_API_PREFIX) &&
    request.headers.get(DEMO_ADMIN_MODE_HEADER) === 'true'
  ) {
    return applySecurityHeaders(
      new Response(JSON.stringify({ error: DEMO_ACTION_BLOCKED_MESSAGE }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      { isProd, isHttps },
    );
  }

  const allowlist = parseAllowedOrigins({
    publicSiteUrl:
      (import.meta.env.PUBLIC_SITE_URL as string | undefined) ?? process.env.PUBLIC_SITE_URL,
    allowedOrigins:
      (import.meta.env.ALLOWED_ORIGINS as string | undefined) ?? process.env.ALLOWED_ORIGINS,
  });
  const allowVercelPreview =
    (import.meta.env.ALLOW_VERCEL_PREVIEW_ORIGINS ?? process.env.ALLOW_VERCEL_PREVIEW_ORIGINS) ===
    'true';

  const originResult = evaluateOriginGate({
    method,
    pathname: url.pathname,
    request,
    allowlist,
    allowVercelPreview,
    isProd,
  });

  if (!originResult.allowed) {
    console.warn('[security] Blocked API request due to disallowed origin', {
      method,
      path: url.pathname,
      reason: originResult.reason,
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      host: request.headers.get('host'),
      forwardedHost: request.headers.get('x-forwarded-host'),
      forwardedProto: request.headers.get('x-forwarded-proto'),
      allowlist: [...allowlist],
    });

    return applySecurityHeaders(
      new Response('Cross-site POST form submissions are forbidden', { status: 403 }),
      { isProd, isHttps },
    );
  }

  const response = await next();
  if (response.status >= 500 && url.pathname.startsWith('/api/')) {
    try {
      const { captureOpsException } = await import('@/lib/ops/sentry');
      captureOpsException(new Error(`HTTP ${response.status} ${url.pathname}`), {
        route: url.pathname,
        tags: { status: String(response.status), method },
      });
    } catch {
      /* Sentry optional */
    }
  }
  return applySecurityHeaders(response, { isProd, isHttps });
});
