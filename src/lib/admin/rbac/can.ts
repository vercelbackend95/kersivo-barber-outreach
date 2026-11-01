import type { ShopRole } from '@prisma/client';
import { permissionsForRole, type Permission } from './permissions';

export function can(role: ShopRole, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function accessCan(
  access: { role: ShopRole; via?: string; permissions?: readonly Permission[] },
  permission: Permission,
): boolean {
  // Hub keeps role OWNER for the SPA, but RBAC must honour the restricted permission list.
  if (access.via === 'hub') {
    return Boolean(access.permissions?.includes(permission));
  }
  return can(access.role, permission);
}

/** Returns a 403 Response when denied; otherwise null. */
export function requirePermission(
  access: { role: ShopRole },
  permission: Permission,
): Response | null {
  if (accessCan(access, permission)) return null;
  return new Response(
    JSON.stringify({ error: 'Forbidden', permission }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  );
}

export function requireAnyPermission(
  access: { role: ShopRole },
  permissions: Permission[],
): Response | null {
  if (permissions.some((p) => accessCan(access, p))) return null;
  return new Response(
    JSON.stringify({ error: 'Forbidden', permissions }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  );
}
