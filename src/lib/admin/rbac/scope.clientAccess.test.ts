import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminAccess } from '@/lib/admin/auth';

const clientFindFirst = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    client: {
      findFirst: (...args: unknown[]) => clientFindFirst(...args),
    },
  },
}));

import { assertClientAccessible } from './scope';

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

describe('assertClientAccessible shop-wide', () => {
  beforeEach(() => {
    clientFindFirst.mockReset();
  });

  it('allows BARBER any client in the same shop without a prior booking', async () => {
    clientFindFirst.mockResolvedValue({ id: 'client_other' });

    const result = await assertClientAccessible(
      fakeAccess({ role: 'BARBER', barberId: 'b1' }),
      'client_other',
    );

    expect(result).toEqual({ id: 'client_other' });
    expect(clientFindFirst).toHaveBeenCalledWith({
      where: { id: 'client_other', shopId: 'shop_1' },
      select: { id: true },
    });
  });

  it('returns 404 when client is outside the shop', async () => {
    clientFindFirst.mockResolvedValue(null);

    const result = await assertClientAccessible(
      fakeAccess({ role: 'BARBER', barberId: 'b1' }),
      'client_missing',
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(404);
  });

  it('allows unlinked BARBER to read any shop client', async () => {
    clientFindFirst.mockResolvedValue({ id: 'client_1' });

    const result = await assertClientAccessible(
      fakeAccess({ role: 'BARBER', barberId: null }),
      'client_1',
    );

    expect(result).toEqual({ id: 'client_1' });
    expect(clientFindFirst).toHaveBeenCalled();
  });
});
