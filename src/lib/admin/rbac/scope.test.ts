import { describe, expect, it } from 'vitest';
import { can } from './can';
import { requireLinkedBarber } from './scope';
import type { AdminAccess } from '@/lib/admin/auth';

function fakeAccess(partial: Partial<AdminAccess> & Pick<AdminAccess, 'role'>): AdminAccess {
  return {
    shopId: 'shop_1',
    userId: 'user_1',
    userName: 'Test',
    userEmail: 't@example.com',
    emailVerified: true,
    userImage: null,
    via: 'session',
    memberId: 'm1',
    barberId: null,
    permissions: [],
    ...partial,
  };
}

describe('RBAC scope helpers', () => {
  it('blocks BARBER without linked roster seat', () => {
    const res = requireLinkedBarber(fakeAccess({ role: 'BARBER', barberId: null }));
    expect(res).toBeInstanceOf(Response);
    expect(res?.status).toBe(403);
  });

  it('allows BARBER with barberId', () => {
    expect(requireLinkedBarber(fakeAccess({ role: 'BARBER', barberId: 'b1' }))).toBeNull();
  });

  it('does not block OWNER/MANAGER for linked-barber check', () => {
    expect(requireLinkedBarber(fakeAccess({ role: 'OWNER' }))).toBeNull();
    expect(requireLinkedBarber(fakeAccess({ role: 'MANAGER' }))).toBeNull();
  });

  it('BARBER cannot manage catalog or billing', () => {
    expect(can('BARBER', 'catalog.manage')).toBe(false);
    expect(can('BARBER', 'billing.manage')).toBe(false);
    expect(can('BARBER', 'bookings.self')).toBe(true);
  });
});
