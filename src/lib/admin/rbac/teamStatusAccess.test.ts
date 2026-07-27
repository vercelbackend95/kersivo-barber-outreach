import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { can } from '@/lib/admin/rbac/can';
import { permissionsForRole } from '@/lib/admin/rbac/permissions';
import { isJoinedTeamMemberStatus } from '@/lib/admin/teamCards';

/**
 * Phase 1C: teamStatus must not gate dashboard membership/RBAC.
 * NEW (legacy) and ACTIVE are both joined/usable; role alone drives permissions.
 */
describe('legacy NEW membership / RBAC compatibility', () => {
  it('treats NEW as joined for presentation compatibility', () => {
    expect(isJoinedTeamMemberStatus('NEW')).toBe(true);
    expect(isJoinedTeamMemberStatus('ACTIVE')).toBe(true);
  });

  it('Manager permissions are available immediately after acceptance (role-based)', () => {
    expect(can('MANAGER', 'bookings.manage')).toBe(true);
    expect(can('MANAGER', 'members.invite_barber')).toBe(true);
    expect(can('MANAGER', 'catalog.manage')).toBe(true);
    expect(permissionsForRole('MANAGER')).toContain('bookings.manage');
  });

  it('Barber permissions are available immediately after acceptance (role-based)', () => {
    expect(can('BARBER', 'team.read')).toBe(true);
    expect(can('BARBER', 'bookings.self')).toBe(true);
    expect(can('BARBER', 'clients.read')).toBe(true);
    expect(can('BARBER', 'clients.write')).toBe(true);
    expect(can('BARBER', 'bookings.manage')).toBe(false);
    expect(permissionsForRole('BARBER')).toEqual([
      'team.read',
      'bookings.self',
      'clients.read',
      'clients.write',
    ]);
  });

  it('getMembershipForUser does not filter or select teamStatus', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/auth/provisionShop.ts'), 'utf8');
    const fnStart = src.indexOf('export async function getMembershipForUser');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = src.slice(fnStart, fnStart + 800);
    expect(fnBody).not.toMatch(/teamStatus/);
    expect(fnBody).toMatch(/role:\s*true/);
  });

  it('resolveAdminAccess builds access from role without teamStatus', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/admin/auth.ts'), 'utf8');
    const fnStart = src.indexOf('export async function resolveAdminAccess');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = src.slice(fnStart, fnStart + 1200);
    expect(fnBody).not.toMatch(/teamStatus/);
    expect(fnBody).toMatch(/membership\.role/);
  });

  it('can() / permissionsForRole do not reference teamStatus', () => {
    const canSrc = readFileSync(resolve(process.cwd(), 'src/lib/admin/rbac/can.ts'), 'utf8');
    const permSrc = readFileSync(
      resolve(process.cwd(), 'src/lib/admin/rbac/permissions.ts'),
      'utf8',
    );
    expect(canSrc).not.toMatch(/teamStatus/);
    expect(permSrc).not.toMatch(/teamStatus/);
  });
});
