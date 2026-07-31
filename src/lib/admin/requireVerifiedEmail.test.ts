import { describe, expect, it } from 'vitest';
import {
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  requireVerifiedEmail,
  type AdminAccess,
} from '@/lib/admin/auth';

function access(partial: Partial<AdminAccess> & Pick<AdminAccess, 'via' | 'emailVerified'>): AdminAccess {
  return {
    shopId: 'shop-1',
    userId: 'user-1',
    userName: 'Owner',
    userEmail: 'owner@example.com',
    userImage: null,
    role: 'OWNER',
    memberId: 'm1',
    barberId: null,
    permissions: [],
    ...partial,
  };
}

describe('requireVerifiedEmail', () => {
  it('allows verified session users', () => {
    expect(requireVerifiedEmail(access({ via: 'session', emailVerified: true }))).toBeNull();
  });

  it('blocks unverified session users', async () => {
    const res = requireVerifiedEmail(access({ via: 'session', emailVerified: false }));
    expect(res).toBeInstanceOf(Response);
    expect(res?.status).toBe(403);
    const body = await res!.json();
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(body.error).toBe(EMAIL_VERIFICATION_REQUIRED_MESSAGE);
  });

  it('treats secret and legacy-cookie access as verified', () => {
    expect(requireVerifiedEmail(access({ via: 'secret', emailVerified: false }))).toBeNull();
    expect(requireVerifiedEmail(access({ via: 'legacy-cookie', emailVerified: false }))).toBeNull();
  });
});
