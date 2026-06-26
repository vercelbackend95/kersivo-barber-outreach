import { defineMiddleware } from 'astro:middleware';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ADMIN_API_PREFIX = '/api/admin';
const VERCEL_PREVIEW_SUFFIX = '.vercel.app';

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

function parseAllowedOrigins(): Set<string> {
  const values = new Set<string>();

  const fromEnv = [
    import.meta.env.PUBLIC_SITE_URL,
    process.env.PUBLIC_SITE_URL,
    import.meta.env.ALLOWED_ORIGINS,
    process.env.ALLOWED_ORIGINS
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(','));

  const defaults = [
    'https://kersivo.co.uk',
    'https://www.kersivo.co.uk',
    'https://kersivo-barber-outreach.vercel.app'
  ];

  for (const candidate of [...fromEnv, ...defaults]) {
    const normalized = normalizeOrigin(candidate.trim());
    if (normalized) values.add(normalized);
  }

  return values;
}

function getRequestHostOrigin(request: Request): string | null {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return null;

  const proto = request.headers.get('x-forwarded-proto') ?? (import.meta.env.PROD ? 'https' : 'http');
  return normalizeOrigin(`${proto}://${host}`);
}

function isAllowedOrigin(origin: string, allowlist: Set<string>, allowVercelPreview: boolean): boolean {
  if (allowlist.has(origin)) return true;
  if (!allowVercelPreview) return false;

  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith(VERCEL_PREVIEW_SUFFIX);
  } catch {
    return false;
  }
}

function getCandidateOrigin(request: Request): string | null {
  const origin = normalizeOrigin(request.headers.get('origin'));
  if (origin) return origin;

  const referer = request.headers.get('referer');
  return normalizeOrigin(referer);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;
  const method = request.method.toUpperCase();

  if (SAFE_METHODS.has(method) || !url.pathname.startsWith(ADMIN_API_PREFIX)) {
    return next();
  }

  const allowlist = parseAllowedOrigins();
  const allowVercelPreview = (import.meta.env.ALLOW_VERCEL_PREVIEW_ORIGINS ?? process.env.ALLOW_VERCEL_PREVIEW_ORIGINS) === 'true';

  const candidateOrigin = getCandidateOrigin(request);
  const hostOrigin = getRequestHostOrigin(request);

  const isAllowed = candidateOrigin
    ? candidateOrigin === hostOrigin || isAllowedOrigin(candidateOrigin, allowlist, allowVercelPreview)
    : false;

  if (!isAllowed) {
    console.warn('[security] Blocked admin API request due to disallowed origin', {
      method,
      path: url.pathname,
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      host: request.headers.get('host'),
      forwardedHost: request.headers.get('x-forwarded-host'),
      forwardedProto: request.headers.get('x-forwarded-proto'),
      derivedHostOrigin: hostOrigin,
      allowlist: [...allowlist]
    });

    return new Response('Cross-site POST form submissions are forbidden', { status: 403 });
  }

  return next();
});
