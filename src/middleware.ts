import { defineMiddleware } from 'astro:middleware';
// Ensure server Sentry is initialized for API routes (page-ssr alone does not load for /api/*).
import '../sentry.server.config';
import type { APIContext } from 'astro';
import { DEMO_ACTION_BLOCKED_MESSAGE, DEMO_ADMIN_MODE_HEADER } from '@/lib/admin/demoConfig';
import { ADMIN_PRIVATE_HEADERS, adminSessionShopFor, resolveAdminPageMode } from '@/lib/adminHub/adminMode';
import {
  hubAdminUnavailableResponse,
  isAdminApiPath,
  isHubAdminApiAllowed,
  isHubOnlyAdminApiRequest,
  recordHubOwnerAdminEdit,
} from '@/lib/adminHub/hubAdminAccess';
import { isAdminHubRouteEnabled } from '@/lib/freePreview/hubPage';
import { isPreviewHubAllowedPath } from '@/lib/adminHub/previewHubPaths';
import { applySecurityHeaders } from '@/lib/security/headers';
import {
  SAFE_METHODS,
  evaluateOriginGate,
  parseAllowedOrigins,
} from '@/lib/security/origin';

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
    url.pathname.startsWith('/admin') &&
    !url.pathname.startsWith('/api/') &&
    isAdminHubRouteEnabled()
  ) {
    const mode = await resolveAdminPageMode({
      request,
      now: new Date(),
      sessionShop: () => adminSessionShopFor(context as unknown as APIContext),
    });
    if (mode?.kind === 'hub') {
      context.locals.adminHubMode = mode;
      if (url.pathname !== '/admin/hub' && !isPreviewHubAllowedPath(url.pathname)) {
        const headers = new Headers({ Location: '/admin', ...ADMIN_PRIVATE_HEADERS });
        if (mode.setCookie) headers.append('Set-Cookie', mode.setCookie);
        return applySecurityHeaders(new Response(null, { status: 303, headers }), { isProd, isHttps });
      }
    }
  }

  if (
    !SAFE_METHODS.has(method) &&
    isAdminApiPath(url.pathname) &&
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

  const hubOnlyAdminApi = isAdminApiPath(url.pathname) && isHubOnlyAdminApiRequest(request);
  if (hubOnlyAdminApi && !isHubAdminApiAllowed(method, url.pathname)) {
    return applySecurityHeaders(hubAdminUnavailableResponse(), { isProd, isHttps });
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
  if (hubOnlyAdminApi && response.ok) {
    try {
      await recordHubOwnerAdminEdit({ request, pathname: url.pathname, method });
    } catch {
      /* activity is best-effort */
    }
  }
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
