import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  shopMemberFindFirst,
  shopMemberFindMany,
  shopMemberUpdate,
  barberFindMany,
  barberUpdate,
  shopInviteFindMany,
} = vi.hoisted(() => ({
  shopMemberFindFirst: vi.fn(),
  shopMemberFindMany: vi.fn(),
  shopMemberUpdate: vi.fn(),
  barberFindMany: vi.fn(),
  barberUpdate: vi.fn(),
  shopInviteFindMany: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopMember: {
      findFirst: (...a: unknown[]) => shopMemberFindFirst(...a),
      findMany: (...a: unknown[]) => shopMemberFindMany(...a),
      update: (...a: unknown[]) => shopMemberUpdate(...a),
    },
    barber: {
      findMany: (...a: unknown[]) => barberFindMany(...a),
      update: (...a: unknown[]) => barberUpdate(...a),
    },
    shopInvite: {
      findMany: (...a: unknown[]) => shopInviteFindMany(...a),
    },
  },
}));

import {
  findActiveOrphanBarbers,
  linkMemberToBarber,
  namesLikelySame,
  unlinkMemberBarber,
} from './onboardingOwnerSeat';
import { prisma } from '@/lib/db/client';

describe('onboardingOwnerSeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shopMemberFindMany.mockResolvedValue([]);
    shopInviteFindMany.mockResolvedValue([]);
    barberUpdate.mockResolvedValue({ id: 'b1' });
    shopMemberUpdate.mockResolvedValue({ id: 'm1' });
  });

  it('linkMemberToBarber sets Barber.userId and ShopMember.barberId', async () => {
    await linkMemberToBarber(prisma, {
      memberId: 'm1',
      barberId: 'b1',
      userId: 'u1',
      email: 'o@example.com',
    });
    expect(barberUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { userId: 'u1', email: 'o@example.com' },
      select: { id: true },
    });
    expect(shopMemberUpdate).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { barberId: 'b1' },
      select: { id: true },
    });
  });

  it('unlinkMemberBarber clears both sides', async () => {
    await unlinkMemberBarber(prisma, { memberId: 'm1', barberId: 'b1' });
    expect(shopMemberUpdate).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { barberId: null },
      select: { id: true },
    });
    expect(barberUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { userId: null },
      select: { id: true },
    });
  });

  it('findActiveOrphanBarbers excludes linked seats', async () => {
    barberFindMany.mockResolvedValue([
      { id: 'b-orphan', name: 'A', avatarUrl: null },
      { id: 'b-linked', name: 'B', avatarUrl: null },
    ]);
    shopMemberFindMany.mockResolvedValue([{ barberId: 'b-linked' }]);
    const orphans = await findActiveOrphanBarbers('shop-1');
    expect(orphans.map((o) => o.id)).toEqual(['b-orphan']);
  });

  describe('namesLikelySame', () => {
    it('matches trimmed case-insensitive names', () => {
      expect(namesLikelySame('  Bartosz Jasinski ', 'bartosz jasinski')).toBe(true);
      expect(namesLikelySame('Bartosz', 'Papi')).toBe(false);
      expect(namesLikelySame('', 'Papi')).toBe(false);
    });
  });
});
