import { resolveHubContext, isAdminHubRouteEnabled } from '@/lib/freePreview/hubPage';
import { PREVIEW_PAGE_RATE } from '@/lib/freePreview/previewApi';
import { PRIVATE_PREVIEW_HEADERS, previewNotFoundResponse } from '@/lib/freePreview/previewHeaders';
import { resolveOperatorAccess } from '@/lib/ops/operatorAuth';
import { enforceIpRateLimit } from '@/lib/rate-limit/enforceIpRateLimit';
import { mintHubCookie } from './hubSession';
import { adminHubUrlFor, type HubBridgeSubroute } from './links';

/**
 * /preview/{token}[/sub] with ADMIN_HUB_ENABLED: swap the token for `ks_hub` and 303 to /admin
 * (docs/admin-hub/ADMIN_HUB_SPEC.md §2.2). Returns null when the page should keep today's behaviour
 * (flag off, or no auth secret to sign the cookie with).
 */
export async function adminHubBridge(input: {
  request: Request;
  url: URL;
  token: string;
  subroute: HubBridgeSubroute;
  /** The root token page has already applied PREVIEW_PAGE_RATE. */
  rateLimit: boolean;
  now?: Date;
}): Promise<Response | null> {
  if (!isAdminHubRouteEnabled()) return null;

  if (input.rateLimit) {
    const limited = await enforceIpRateLimit(
      input.request,
      PREVIEW_PAGE_RATE.action,
      PREVIEW_PAGE_RATE.limit,
      PREVIEW_PAGE_RATE.windowMs,
    );
    if (limited) return limited;
  }

  const now = input.now ?? new Date();
  const operator = await resolveOperatorAccess(input.request);
  const ctx = await resolveHubContext({ token: input.token.trim() }, { isOperator: operator.ok, now });
  if (!ctx) return previewNotFoundResponse();

  const cookie = mintHubCookie({
    previewRequestId: ctx.request.id,
    stage: ctx.state.stage,
    previewExpiresAt: ctx.request.expiresAt,
    operator: ctx.isOperator,
    now,
  });
  if (!cookie) {
    console.error('[admin-hub] no auth secret configured; keeping the token page');
    return null;
  }

  const headers = new Headers(PRIVATE_PREVIEW_HEADERS);
  headers.set('Location', adminHubUrlFor(input.subroute, input.url.searchParams));
  headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
}
