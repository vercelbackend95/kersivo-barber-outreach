import type { ShopRole } from '@prisma/client';

/** Permission keys enforced on admin API (and used to drive UI). */
export const PERMISSIONS = [
  'billing.manage',
  'members.manage',
  'members.invite_barber',
  'team.read',
  'shop.settings',
  'catalog.manage',
  'bookings.manage',
  'bookings.self',
  'clients.read',
  'clients.write',
  'retail.manage',
  'reports.view',
  'ai.use',
  'onboarding.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_OWNER: Permission[] = [...PERMISSIONS];

const MANAGER: Permission[] = [
  'members.invite_barber',
  'team.read',
  'shop.settings',
  'catalog.manage',
  'bookings.manage',
  'bookings.self',
  'clients.read',
  'clients.write',
  'retail.manage',
  'reports.view',
  'ai.use',
  'onboarding.manage',
];

const BARBER: Permission[] = [
  'team.read',
  'bookings.self',
  'clients.read',
  'clients.write',
];

export const ROLE_PERMISSIONS: Record<ShopRole, readonly Permission[]> = {
  OWNER: ALL_OWNER,
  MANAGER: MANAGER,
  BARBER: BARBER,
};

export function permissionsForRole(role: ShopRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
