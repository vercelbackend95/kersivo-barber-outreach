import type { APIContext } from 'astro';
import type { ShopRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import {
  ensureOwnerMembership,
  getMembershipForUser,
  getShopIdForUser,
} from '@/lib/auth/provisionShop';
import { DEMO_SHOP_ID, resolveShopId } from '@/lib/db/shopScope';
import { requirePermission as denyUnless } from '@/lib/admin/rbac/can';
import type { Permission } from '@/lib/admin/rbac/permissions';
import { permissionsForRole } from '@/lib/admin/rbac/permissions';
import { getAdminSessionCookieName, getSessionSecret, parseAdminSessionToken } from './session';

export type AdminAccess = {
  shopId: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  via: 'session' | 'secret' | 'legacy-cookie';
  role: ShopRole;
  memberId: string | null;
  barberId: string | null;
  permissions: readonly Permission[];
};

export function getSessionBarberId(context: APIContext): string | null {
  const sessionSecret = getSessionSecret();
  const cookieToken = context.cookies.get(getAdminSessionCookieName())?.value;
  if (!cookieToken || !sessionSecret) return null;
  return parseAdminSessionToken(cookieToken, sessionSecret)?.barberId ?? null;
}

export function resolveNoteAuthorBarberId(context: APIContext): string | null {
  return getSessionBarberId(context);
}

function isSecretAuthorized(context: APIContext): boolean {
  const secret = import.meta.env.ADMIN_SECRET ?? process.env.ADMIN_SECRET;
  const header = context.request.headers.get('x-admin-secret');
  return !!secret && header === secret;
}

function isLegacyCookieAuthorized(context: APIContext): boolean {
  const sessionSecret = getSessionSecret();
  const cookieToken = context.cookies.get(getAdminSessionCookieName())?.value;
  return Boolean(cookieToken && sessionSecret && parseAdminSessionToken(cookieToken, sessionSecret));
}

function buildAccess(input: {
  shopId: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  via: AdminAccess['via'];
  role: ShopRole;
  memberId: string | null;
  barberId: string | null;
}): AdminAccess {
  return {
    ...input,
    permissions: permissionsForRole(input.role),
  };
}

export async function resolveAdminAccess(context: APIContext): Promise<AdminAccess | null> {
  try {
    const session = await auth.api.getSession({ headers: context.request.headers });
    if (session?.user?.id) {
      const userId = session.user.id;
      let membership = await getMembershipForUser(userId);

      if (!membership) {
        const shopId = await getShopIdForUser(userId);
        if (shopId) {
          await ensureOwnerMembership(shopId, userId);
          membership = await getMembershipForUser(userId, shopId);
        }
      }

      if (membership) {
        return buildAccess({
          shopId: membership.shopId,
          userId,
          userName: session.user.name ?? null,
          userEmail: session.user.email ?? null,
          userImage: session.user.image ?? null,
          via: 'session',
          role: membership.role,
          memberId: membership.id,
          barberId: membership.barberId,
        });
      }
    }
  } catch {
    // Fall through to legacy admin auth.
  }

  if (isSecretAuthorized(context) || isLegacyCookieAuthorized(context)) {
    const shopId = (await resolveShopId()) || DEMO_SHOP_ID;
    const legacyBarberId = getSessionBarberId(context);
    return buildAccess({
      shopId,
      userId: null,
      userName: null,
      userEmail: null,
      userImage: null,
      via: isSecretAuthorized(context) ? 'secret' : 'legacy-cookie',
      role: 'OWNER',
      memberId: null,
      barberId: legacyBarberId,
    });
  }

  return null;
}

/** @deprecated Prefer resolveAdminAccess / requireAdminContext for shop-scoped routes. */
export function isAdminAuthorized(context: APIContext): boolean {
  return isSecretAuthorized(context) || isLegacyCookieAuthorized(context);
}

export async function requireAdmin(context: APIContext): Promise<Response | null> {
  const access = await resolveAdminAccess(context);
  if (!access) {
    console.error('[admin/auth] Unauthorized admin API request.', {
      path: new URL(context.request.url).pathname,
    });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return null;
}

export async function requireAdminContext(
  context: APIContext,
): Promise<AdminAccess | Response> {
  const access = await resolveAdminAccess(context);
  if (!access) {
    console.error('[admin/auth] Unauthorized admin API request.', {
      path: new URL(context.request.url).pathname,
    });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return access;
}

/** Auth + permission gate in one call. */
export async function requireAdminPermission(
  context: APIContext,
  permission: Permission,
): Promise<AdminAccess | Response> {
  const access = await requireAdminContext(context);
  if (access instanceof Response) return access;
  const denied = denyUnless(access, permission);
  if (denied) return denied;
  return access;
}
