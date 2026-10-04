import type { APIContext } from 'astro';
import { requireAdminPermission, type AdminAccess } from './auth';
import type { Permission } from './rbac/permissions';
import { ADMIN_UPGRADE_QUERY_PARAM, CAPABILITY_UPGRADE_FEATURE, isPlanLockedState } from './productLocks';
import { isDemoShopId } from '@/lib/shop/cardPaymentsGate';
import {
  hasKersivoCapability,
  loadKersivoAccess,
  type KersivoAccess,
  type KersivoCapability,
} from '@/lib/shop/kersivoAccess';

/**
 * KERSIVO product-capability gate for admin APIs. Runs after RBAC:
 * authenticate → RBAC permission → product capability → business operation.
 * Never grants or removes RBAC permissions.
 */

export const KERSIVO_UPGRADE_REQUIRED = 'KERSIVO_UPGRADE_REQUIRED';
export const KERSIVO_UPGRADE_REQUIRED_MESSAGE = 'This feature is available with Full KERSIVO.';

/**
 * Plan locks apply to real signed-in tenants only. Deliberately not enforced for:
 * - guest preview (`preview`): a provisional SETUP shop that showcases the Full dashboard;
 * - legacy development access (`secret` / `legacy-cookie`);
 * - demo shops (public demo / BLACKLINE), which always resolve to SETUP yet showcase Full.
 * Among enforced tenants only FREE_BOOKING is locked (see isPlanLockedState).
 */
export function adminProductCapabilityEnforced(access: Pick<AdminAccess, 'via' | 'shopId'>): boolean {
  return access.via === 'session' && !isDemoShopId(access.shopId);
}

export function kersivoUpgradeRequiredResponse(capability: KersivoCapability): Response {
  return new Response(
    JSON.stringify({
      error: KERSIVO_UPGRADE_REQUIRED_MESSAGE,
      code: KERSIVO_UPGRADE_REQUIRED,
      requiredCapability: capability,
    }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  );
}

export type AdminProductCapabilityGrant = {
  access: AdminAccess;
  /** Null when plan locks are not enforced for this access (see adminProductCapabilityEnforced). */
  productAccess: KersivoAccess | null;
};

export async function requireAdminProductCapability(
  access: AdminAccess,
  capability: KersivoCapability,
  now: Date = new Date(),
): Promise<AdminProductCapabilityGrant | Response> {
  if (!adminProductCapabilityEnforced(access)) return { access, productAccess: null };
  const productAccess = await loadKersivoAccess(access.shopId, now);
  if (isPlanLockedState(productAccess.state) && !hasKersivoCapability(productAccess, capability)) {
    return kersivoUpgradeRequiredResponse(capability);
  }
  return { access, productAccess };
}

/**
 * Admin pages outside the SPA: where to send a tenant whose plan lacks `capability`
 * (the dashboard opens the Full KERSIVO upgrade dialog), or null when allowed.
 */
export async function adminPageUpgradeRedirect(
  access: AdminAccess,
  capability: KersivoCapability,
): Promise<string | null> {
  const grant = await requireAdminProductCapability(access, capability);
  if (!(grant instanceof Response)) return null;
  const feature = CAPABILITY_UPGRADE_FEATURE[capability] ?? 'launch';
  return `/admin?${ADMIN_UPGRADE_QUERY_PARAM}=${feature}`;
}

/** Auth + RBAC permission + product capability in one call. */
export async function requireAdminPermissionAndCapability(
  context: APIContext,
  permission: Permission,
  capability: KersivoCapability,
): Promise<AdminAccess | Response> {
  const access = await requireAdminPermission(context, permission);
  if (access instanceof Response) return access;
  const grant = await requireAdminProductCapability(access, capability);
  if (grant instanceof Response) return grant;
  return access;
}
