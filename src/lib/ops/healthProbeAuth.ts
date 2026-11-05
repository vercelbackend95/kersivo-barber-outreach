/**
 * Shop health HTTP probes identify themselves with X-Kersivo-Health: 1. The header alone proves nothing
 * (anyone can send it), so KERSIVO's own routes only treat a request as a health probe when it also
 * carries X-Kersivo-Health-Secret matching KERSIVO_HEALTH_PROBE_SECRET (compared in constant time).
 *
 * The secret is only ever sent to KERSIVO's own origin, never to a tenant website on another host.
 * A verified probe is not counted as an owner preview view (recordPreviewView). Docs: docs/ops/shop-health.md.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export const HEALTH_PROBE_HEADER = 'x-kersivo-health';
export const HEALTH_PROBE_SECRET_HEADER = 'x-kersivo-health-secret';
export const HEALTH_PROBE_USER_AGENT = 'KERSIVO-HealthCheck/1.0';
export const KERSIVO_ORIGIN = 'https://kersivo.co.uk';
const MIN_SECRET_LENGTH = 24;

type Env = Record<string, string | undefined>;

export function readHealthProbeSecret(env?: Env): string | null {
  const raw = env
    ? env.KERSIVO_HEALTH_PROBE_SECRET
    : (process.env.KERSIVO_HEALTH_PROBE_SECRET ??
      (typeof import.meta !== 'undefined' ? (import.meta.env?.KERSIVO_HEALTH_PROBE_SECRET as string | undefined) : undefined));
  const value = String(raw ?? '').trim();
  // Fail closed: a short or missing secret never verifies anything.
  return value.length >= MIN_SECRET_LENGTH ? value : null;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** True only when the request carries the probe header and the exact server-side secret. */
export function isVerifiedHealthProbe(request: Pick<Request, 'headers'>, env?: Env): boolean {
  if (request.headers.get(HEALTH_PROBE_HEADER) !== '1') return false;
  const secret = readHealthProbeSecret(env);
  const sent = request.headers.get(HEALTH_PROBE_SECRET_HEADER);
  if (!secret || !sent) return false;
  return timingSafeEqual(digest(sent), digest(secret));
}

/** True for https://kersivo.co.uk (and www), the only origin that ever receives the secret. */
export function isKersivoOrigin(url: URL): boolean {
  return url.protocol === 'https:' && (url.hostname === 'kersivo.co.uk' || url.hostname === 'www.kersivo.co.uk') && !url.port;
}

/** Headers for one probe request. The secret is attached for KERSIVO's own origin only. */
export function healthProbeHeaders(target: URL, env?: Env): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': HEALTH_PROBE_USER_AGENT,
    'X-Kersivo-Health': '1',
    Accept: 'text/html,application/json;q=0.9,*/*;q=0.5',
  };
  const secret = readHealthProbeSecret(env);
  if (secret && isKersivoOrigin(target)) headers['X-Kersivo-Health-Secret'] = secret;
  return headers;
}
