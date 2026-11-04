import { timingSafeEqual } from 'node:crypto';
import { isAdminHubRouteEnabled, resolveHubContext, type HubPageContext } from '@/lib/freePreview/hubPage';
import { resolveOperatorAccess, type OperatorAccess } from '@/lib/ops/operatorAuth';
import { hubOperatorBinding, readHubCookie, verifyHubSession, type HubSessionPayload } from './hubSession';

/**
 * "Viewing as KERSIVO": the single answer to "is this request a platform operator impersonating a shop?".
 *
 * Active only when ALL hold:
 * - a valid `ks_hub` operator cookie (signed, unexpired, `op-<binding>` form);
 * - a live Better Auth session whose verified email is on KERSIVO_OPS_EMAILS;
 * - the cookie binding matches that operator's email (a cookie minted for one operator is useless to another).
 *
 * While active, every /admin page AND every /api/admin* handler must use the impersonated shop and nothing else —
 * never the operator's own Better Auth membership (`getActiveShopContext` in `src/lib/admin/auth.ts`).
 */
export type OperatorImpersonationSession = {
  cookie: string;
  session: HubSessionPayload;
  operator: OperatorAccess;
};

function bindingMatches(session: HubSessionPayload, email: string): boolean {
  if (!session.operatorBinding) return false;
  const expected = hubOperatorBinding(email);
  if (!expected) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(session.operatorBinding, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cheap check (no PreviewRequest lookup): cookie + live operator session + binding. */
export async function readOperatorImpersonation(
  request: Request,
  now: Date = new Date(),
): Promise<OperatorImpersonationSession | null> {
  if (!isAdminHubRouteEnabled()) return null;
  const cookie = readHubCookie(request);
  const session = cookie ? verifyHubSession(cookie, now) : null;
  if (!cookie || !session?.operator) return null;
  const operator = await resolveOperatorAccess(request);
  if (!operator.ok) return null;
  if (!bindingMatches(session, operator.access.email)) return null;
  return { cookie, session, operator: operator.access };
}

export type OperatorImpersonation =
  | { active: false }
  /** `ctx` null: the impersonated request no longer resolves (rejected, anonymised…). Deny; never fall back. */
  | { active: true; ctx: HubPageContext | null; operator: OperatorAccess };

export async function resolveOperatorImpersonation(
  request: Request,
  now: Date = new Date(),
): Promise<OperatorImpersonation> {
  const live = await readOperatorImpersonation(request, now);
  if (!live) return { active: false };
  const ctx = await resolveHubContext({ cookie: live.cookie }, { isOperator: true, now });
  return { active: true, ctx, operator: live.operator };
}
