import { BLACKLINE_ADMIN_API_PREFIX } from '@/lib/admin/demoConfig';
import { blacklineHeroShowcaseNow, isHeroShowcaseUrl } from '@/lib/admin/heroShowcase';

/**
 * Client-local data adapter for the landing hero showcase (`/demo/admin?embed=hero`).
 * Every same-origin `/api/*` request is answered from the BLACKLINE fixtures at the
 * canonical showcase clock — the iframe never issues a data request over the network.
 */

let pendingRequests = 0;
let requestSerial = 0;
const activityListeners = new Set<() => void>();

function notifyActivity(): void {
  for (const listener of activityListeners) listener();
}

export function isHeroShowcaseDocument(): boolean {
  if (typeof window === 'undefined') return false;
  return isHeroShowcaseUrl(new URL(window.location.href));
}

export function isSameOriginApiRequest(url: URL | null): url is URL {
  if (!url || typeof window === 'undefined') return false;
  return url.origin === window.location.origin && url.pathname.startsWith('/api/');
}

/** In-flight local requests plus a serial that increments whenever one starts. */
export function getHeroShowcaseRequestActivity(): { pending: number; serial: number } {
  return { pending: pendingRequests, serial: requestSerial };
}

export function subscribeHeroShowcaseRequestActivity(listener: () => void): () => void {
  activityListeners.add(listener);
  return () => {
    activityListeners.delete(listener);
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function toFixturePath(pathname: string): string | null {
  if (pathname.startsWith('/api/admin/')) {
    return `${BLACKLINE_ADMIN_API_PREFIX}/${pathname.slice('/api/admin/'.length)}`;
  }
  if (pathname.startsWith('/api/admin-demo/')) {
    return `${BLACKLINE_ADMIN_API_PREFIX}/${pathname.slice('/api/admin-demo/'.length)}`;
  }
  if (pathname === BLACKLINE_ADMIN_API_PREFIX || pathname.startsWith(`${BLACKLINE_ADMIN_API_PREFIX}/`)) {
    return pathname;
  }
  return null;
}

export async function resolveHeroShowcaseFetch(
  url: URL,
  method: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  pendingRequests += 1;
  requestSerial += 1;
  notifyActivity();
  try {
    const fixturePath = toFixturePath(url.pathname);
    if (!fixturePath) {
      return jsonResponse(404, { error: 'Not available in the showcase.' });
    }
    const { resolveBlacklineDemoFixture } = await import('@/lib/admin/blacklineDemoFixtures/router');
    const request =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : new Request(input instanceof Request ? input : url.toString(), { ...init, method });
    const result = await resolveBlacklineDemoFixture(fixturePath, url.searchParams, method, request, {
      now: blacklineHeroShowcaseNow(),
    });
    if (!result) return jsonResponse(404, { error: 'Not found.' });
    return jsonResponse(result.status, result.body);
  } finally {
    pendingRequests -= 1;
    notifyActivity();
  }
}
