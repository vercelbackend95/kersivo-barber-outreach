const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const VERCEL_PREVIEW_SUFFIX = '.vercel.app';

/** Paths exempt from browser Origin/Referer checks (server-to-server or Better Auth). */
const ORIGIN_EXEMPT_PREFIXES = ['/api/cron/', '/api/ops/', '/api/auth/'] as const;
const ORIGIN_EXEMPT_EXACT = new Set(['/api/shop/webhook']);

export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(env: {
  publicSiteUrl?: string | null;
  allowedOrigins?: string | null;
}): Set<string> {
  const values = new Set<string>();

  const fromEnv = [env.publicSiteUrl, env.allowedOrigins]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(','));

  const defaults = [
    'https://kersivo.co.uk',
    'https://www.kersivo.co.uk',
    'https://kersivo-barber-outreach.vercel.app',
  ];

  for (const candidate of [...fromEnv, ...defaults]) {
    const normalized = normalizeOrigin(candidate.trim());
    if (normalized) values.add(normalized);
  }

  return values;
}

export function getRequestHostOrigin(request: Request, isProd: boolean): string | null {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return null;

  const proto = request.headers.get('x-forwarded-proto') ?? (isProd ? 'https' : 'http');
  return normalizeOrigin(`${proto}://${host}`);
}

export function isAllowedOrigin(
  origin: string,
  allowlist: Set<string>,
  allowVercelPreview: boolean,
): boolean {
  if (allowlist.has(origin)) return true;
  if (!allowVercelPreview) return false;

  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith(VERCEL_PREVIEW_SUFFIX);
  } catch {
    return false;
  }
}

export function getCandidateOrigin(request: Request): string | null {
  const origin = normalizeOrigin(request.headers.get('origin'));
  if (origin) return origin;
  return normalizeOrigin(request.headers.get('referer'));
}

export function isOriginExemptPath(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (ORIGIN_EXEMPT_EXACT.has(normalized)) return true;
  return ORIGIN_EXEMPT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function requiresOriginCheck(method: string, pathname: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  if (!pathname.startsWith('/api/')) return false;
  if (isOriginExemptPath(pathname)) return false;
  return true;
}

export function evaluateOriginGate(input: {
  method: string;
  pathname: string;
  request: Request;
  allowlist: Set<string>;
  allowVercelPreview: boolean;
  isProd: boolean;
}): { allowed: boolean; reason?: string } {
  if (!requiresOriginCheck(input.method, input.pathname)) {
    return { allowed: true };
  }

  const candidateOrigin = getCandidateOrigin(input.request);
  const hostOrigin = getRequestHostOrigin(input.request, input.isProd);

  if (!candidateOrigin) {
    return { allowed: false, reason: 'missing_origin' };
  }

  if (candidateOrigin === hostOrigin) {
    return { allowed: true };
  }

  if (isAllowedOrigin(candidateOrigin, input.allowlist, input.allowVercelPreview)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'disallowed_origin' };
}

export { SAFE_METHODS };
