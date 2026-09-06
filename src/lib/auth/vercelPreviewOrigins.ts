/**
 * Pure helpers for Better Auth trusted origins / base URL on Vercel Preview.
 * Never reads request Origin/Referer. Never emits wildcard origins.
 */

export type VercelPreviewEnv = {
  VERCEL_ENV?: string | null;
  VERCEL_BRANCH_URL?: string | null;
  VERCEL_URL?: string | null;
  BETTER_AUTH_URL?: string | null;
  PUBLIC_SITE_URL?: string | null;
};

export function isVercelPreviewEnv(env: Pick<VercelPreviewEnv, 'VERCEL_ENV'>): boolean {
  return String(env.VERCEL_ENV ?? '') === 'preview';
}

export function hostnameIsAllowedVercelApp(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host || host.includes(':') || host.includes('/') || host.includes(' ')) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return false;
  if (host === 'vercel.app') return true;
  // Must be a subdomain of vercel.app (leading dot required — rejects evilvercel.app).
  if (!host.endsWith('.vercel.app')) return false;
  // Reject empty label before suffix (".vercel.app") and multi-suffix tricks already
  // handled by endsWith; ensure at least one label exists.
  const withoutSuffix = host.slice(0, -'.vercel.app'.length);
  if (!withoutSuffix || withoutSuffix.startsWith('.') || withoutSuffix.endsWith('.')) {
    return false;
  }
  if (withoutSuffix.includes('..')) return false;
  return true;
}

/**
 * Convert a Vercel system hostname (or https URL) into an exact https origin.
 * Rejects userinfo, path, query, fragment, http, localhost, and non-vercel.app hosts.
 */
export function vercelSystemValueToOrigin(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  // Bare hostnames are common for VERCEL_URL / VERCEL_BRANCH_URL.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    if (candidate.includes('://') || candidate.includes('@')) return null;
    // Reject path/query/fragment on bare values before wrapping.
    if (/[/?#]/.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  // pathname is "/" for origin-only URLs; anything else is a path.
  if (url.pathname !== '/' && url.pathname !== '') return null;
  if (url.search || url.hash) return null;
  if (!hostnameIsAllowedVercelApp(url.hostname)) return null;

  return `https://${url.hostname.toLowerCase()}`;
}

/** Preview-only trusted origins from Vercel system env (exact HTTPS, deduped). */
export function resolveVercelPreviewTrustedOrigins(
  env: Pick<VercelPreviewEnv, 'VERCEL_ENV' | 'VERCEL_BRANCH_URL' | 'VERCEL_URL'>,
): string[] {
  if (!isVercelPreviewEnv(env)) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [env.VERCEL_BRANCH_URL, env.VERCEL_URL]) {
    const origin = vercelSystemValueToOrigin(raw);
    if (!origin || seen.has(origin)) continue;
    seen.add(origin);
    out.push(origin);
  }
  return out;
}

export type BetterAuthBaseUrlFallbacks = {
  betterAuthUrl?: string | null;
  publicSiteUrl?: string | null;
  localhostFallback?: string;
};

/**
 * Resolve Better Auth base URL.
 * Preview: prefer validated VERCEL_BRANCH_URL, then VERCEL_URL, then static fallbacks.
 * Non-preview: static fallbacks only (ignore Vercel system URLs).
 */
export function resolveBetterAuthBaseUrl(
  env: VercelPreviewEnv,
  fallbacks: BetterAuthBaseUrlFallbacks = {},
): string {
  const localhost = fallbacks.localhostFallback ?? 'http://localhost:4321';

  if (isVercelPreviewEnv(env)) {
    const fromBranch = vercelSystemValueToOrigin(env.VERCEL_BRANCH_URL);
    if (fromBranch) return fromBranch;
    const fromDeploy = vercelSystemValueToOrigin(env.VERCEL_URL);
    if (fromDeploy) return fromDeploy;
  }

  const better =
    fallbacks.betterAuthUrl ?? env.BETTER_AUTH_URL ?? null;
  const publicSite = fallbacks.publicSiteUrl ?? env.PUBLIC_SITE_URL ?? null;
  const fromEnv = better || publicSite;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  return localhost;
}
