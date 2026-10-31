import type { APIContext } from 'astro';
import { isTenantAdminAccess, resolveAdminAccess } from '@/lib/admin/auth';
import { isAdminHubRouteEnabled, resolveHubContext, type HubPageContext } from '@/lib/freePreview/hubPage';
import { resolvePreviewRequestByDraftShopId } from '@/lib/freePreview/previewAccess';
import { evaluateExactSameOrigin } from '@/lib/ops/requireOperatorMutation';
import { resolveOperatorAccess } from '@/lib/ops/operatorAuth';
import { clearHubCookie, mintHubCookie, readHubCookie, verifyHubSession } from './hubSession';

/** Sent on /admin in every mode once ADMIN_HUB_ENABLED is on (docs/admin-hub/ADMIN_HUB_SPEC.md §2.2). */
export const ADMIN_PRIVATE_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, no-store',
} as const;

/** Tenant access to the full admin: a Better Auth session, or the guest preview cookie. */
export type AdminSessionShop = { shopId: string; role: string; via: 'session' | 'preview' };

export type AdminPageMode =
  | { kind: 'full'; setCookie: string | null }
  | { kind: 'hub'; ctx: HubPageContext; setCookie: string | null; phase: 'preview' | 'launch' };

/**
 * Server-side decision for /admin (spec §2.1–2.3). Null = the flag is off: render today's admin untouched.
 *
 * 1. Operator `ks_hub` + live operator session → hub ("Viewing as KERSIVO"). Without a live session it is dropped.
 * 2. Real session: an OWNER whose shop is a converted preview that is not live → hub, launch phase; otherwise the
 *    full admin (the session wins over any owner `ks_hub`).
 * 3. Owner `ks_hub` → hub while the request still resolves; otherwise the cookie is cleared.
 */
export async function resolveAdminPageMode(input: {
  request: Request;
  now: Date;
  sessionShop: () => Promise<AdminSessionShop | null>;
}): Promise<AdminPageMode | null> {
  if (!isAdminHubRouteEnabled()) return null;
  const { request, now } = input;
  const cookie = readHubCookie(request);
  const session = cookie ? verifyHubSession(cookie, now) : null;
  let clearCookie = Boolean(cookie) && !session;

  if (session?.operator) {
    const operator = await resolveOperatorAccess(request);
    if (operator.ok) {
      const ctx = await resolveHubContext({ cookie }, { isOperator: true, now });
      if (ctx) return { kind: 'hub', ctx, setCookie: null, phase: phaseFor(ctx) };
    }
    clearCookie = true;
  }

  const shop = await input.sessionShop();
  if (shop) {
    if (shop.via === 'session' && shop.role === 'OWNER') {
      const converted = await resolvePreviewRequestByDraftShopId(shop.shopId);
      if (converted) {
        const ctx = await resolveHubContext({ previewRequestId: converted.id }, { isOperator: false, now });
        if (ctx?.state.stage === 'launch') {
          const owns = session && !session.operator && session.previewRequestId === ctx.request.id;
          const setCookie = owns
            ? null
            : mintHubCookie({
                previewRequestId: ctx.request.id,
                stage: ctx.state.stage,
                previewExpiresAt: ctx.request.expiresAt,
                operator: false,
                now,
              });
          return { kind: 'hub', ctx, setCookie, phase: 'launch' };
        }
      }
    }
    return { kind: 'full', setCookie: clearCookie ? clearHubCookie() : null };
  }

  if (session && !session.operator) {
    const operator = await resolveOperatorAccess(request);
    const ctx = await resolveHubContext({ cookie }, { isOperator: operator.ok, now });
    if (ctx) return { kind: 'hub', ctx, setCookie: null, phase: phaseFor(ctx) };
    clearCookie = true;
  }

  return { kind: 'full', setCookie: clearCookie ? clearHubCookie() : null };
}

export async function adminSessionShopFor(context: APIContext): Promise<AdminSessionShop | null> {
  const access = await resolveAdminAccess(context);
  if (!isTenantAdminAccess(access)) return null;
  return { shopId: access.shopId, role: access.role, via: access.via === 'session' ? 'session' : 'preview' };
}

function phaseFor(ctx: HubPageContext): 'preview' | 'launch' {
  return ctx.state.stage === 'launch' || ctx.state.stage === 'live' ? 'launch' : 'preview';
}

/**
 * Same-origin check for plain form POSTs from /admin. Pages there use Referrer-Policy: no-referrer, so browsers
 * send `Origin: null`; Sec-Fetch-Site (not settable by scripts) then decides.
 */
export function isSameOriginFormPost(request: Request): boolean {
  if (evaluateExactSameOrigin(request).ok) return true;
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  return (origin === null || origin === 'null') && site === 'same-origin';
}
