import { describe, expect, it } from 'vitest';
import { can } from './can';
import { PERMISSIONS, permissionsForRole, type Permission } from './permissions';

const MANAGER_OPERATIONAL: Permission[] = [
  'members.invite_barber',
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

describe('RBAC matrix', () => {
  it('OWNER has every permission', () => {
    for (const permission of PERMISSIONS) {
      expect(can('OWNER', permission)).toBe(true);
    }
  });

  it('MANAGER has operational salon access', () => {
    for (const permission of MANAGER_OPERATIONAL) {
      expect(can('MANAGER', permission)).toBe(true);
    }
    expect(permissionsForRole('MANAGER')).toEqual(MANAGER_OPERATIONAL);
  });

  it('MANAGER cannot manage billing or full members', () => {
    expect(can('MANAGER', 'billing.manage')).toBe(false);
    expect(can('MANAGER', 'members.manage')).toBe(false);
    expect(can('MANAGER', 'members.invite_barber')).toBe(true);
    expect(can('MANAGER', 'bookings.manage')).toBe(true);
    expect(can('MANAGER', 'retail.manage')).toBe(true);
  });

  it('BARBER is limited to self bookings and clients', () => {
    expect(permissionsForRole('BARBER')).toEqual([
      'bookings.self',
      'clients.read',
      'clients.write',
    ]);
    expect(can('BARBER', 'billing.manage')).toBe(false);
    expect(can('BARBER', 'catalog.manage')).toBe(false);
    expect(can('BARBER', 'bookings.manage')).toBe(false);
    expect(can('BARBER', 'bookings.self')).toBe(true);
    expect(can('BARBER', 'reports.view')).toBe(false);
    expect(can('BARBER', 'retail.manage')).toBe(false);
    expect(can('BARBER', 'members.manage')).toBe(false);
    expect(can('BARBER', 'onboarding.manage')).toBe(false);
  });
});
