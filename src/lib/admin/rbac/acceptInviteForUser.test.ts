import { beforeEach, describe, expect, it, vi } from 'vitest';

const shopMemberFindUnique = vi.fn();
const shopMemberCreate = vi.fn();
const shopMemberUpdate = vi.fn();
const shopInviteUpdate = vi.fn();
const barberFindFirst = vi.fn();
const barberUpdate = vi.fn();
const barberCreate = vi.fn();
const runSerializableTransaction = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopMember: {
      findUnique: (...a: unknown[]) => shopMemberFindUnique(...a),
      create: (...a: unknown[]) => shopMemberCreate(...a),
      update: (...a: unknown[]) => shopMemberUpdate(...a),
    },
    shopInvite: {
      update: (...a: unknown[]) => shopInviteUpdate(...a),
    },
    barber: {
      findFirst: (...a: unknown[]) => barberFindFirst(...a),
      update: (...a: unknown[]) => barberUpdate(...a),
      create: (...a: unknown[]) => barberCreate(...a),
    },
  },
}));

vi.mock('@/lib/db/serializableTransaction', () => ({
  runSerializableTransaction: (...a: unknown[]) => runSerializableTransaction(...a),
}));

vi.mock('@/lib/admin/defaultAvailability', () => ({
  ensureBarberHasAllServices: vi.fn(),
  ensureBarberHasAvailabilityRules: vi.fn(),
}));

import { acceptInviteForUser } from './members';

describe('acceptInviteForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runSerializableTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        barber: {
          findFirst: (...a: unknown[]) => barberFindFirst(...a),
          update: (...a: unknown[]) => barberUpdate(...a),
          create: (...a: unknown[]) => barberCreate(...a),
        },
        shopMember: {
          findUnique: (...a: unknown[]) => shopMemberFindUnique(...a),
          create: (...a: unknown[]) => shopMemberCreate(...a),
          update: (...a: unknown[]) => shopMemberUpdate(...a),
        },
        shopInvite: {
          update: (...a: unknown[]) => shopInviteUpdate(...a),
        },
      }),
    );
  });

  it('performs ShopMember lookup inside the transaction', async () => {
    shopMemberFindUnique.mockResolvedValue(null);
    barberFindFirst.mockResolvedValue({ id: 'b1', userId: null });
    barberUpdate.mockResolvedValue({ id: 'b1' });
    shopMemberCreate.mockResolvedValue({ id: 'm1' });
    shopInviteUpdate.mockResolvedValue({});

    await acceptInviteForUser(
      { id: 'inv-1', shopId: 'shop-1', role: 'BARBER', barberId: 'b1' },
      'user-1',
    );

    expect(runSerializableTransaction).toHaveBeenCalledTimes(1);
    expect(shopMemberFindUnique).toHaveBeenCalledWith({
      where: { shopId_userId: { shopId: 'shop-1', userId: 'user-1' } },
      select: { id: true, barberId: true, teamStatus: true },
    });
  });

  it('creates ShopMember with teamStatus ACTIVE, never NEW', async () => {
    shopMemberFindUnique.mockResolvedValue(null);
    barberFindFirst.mockResolvedValue({ id: 'b1', userId: null });
    barberUpdate.mockResolvedValue({ id: 'b1' });
    shopMemberCreate.mockResolvedValue({ id: 'm1' });
    shopInviteUpdate.mockResolvedValue({});

    const result = await acceptInviteForUser(
      { id: 'inv-1', shopId: 'shop-1', role: 'BARBER', barberId: 'b1' },
      'user-1',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyMember).toBe(false);
    expect(barberCreate).not.toHaveBeenCalled();
    expect(barberUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { userId: 'user-1' },
    });
    expect(barberUpdate.mock.calls[0][0].data.active).toBeUndefined();
    expect(shopMemberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          barberId: 'b1',
          teamStatus: 'ACTIVE',
        }),
      }),
    );
    expect(shopMemberCreate.mock.calls[0][0].data.teamStatus).not.toBe('NEW');
  });

  it('does not create a Barber for dashboard-only invites', async () => {
    shopMemberFindUnique.mockResolvedValue(null);
    shopMemberCreate.mockResolvedValue({ id: 'm1' });
    shopInviteUpdate.mockResolvedValue({});

    await acceptInviteForUser(
      { id: 'inv-2', shopId: 'shop-1', role: 'MANAGER', barberId: null },
      'user-2',
    );

    expect(barberFindFirst).not.toHaveBeenCalled();
    expect(barberUpdate).not.toHaveBeenCalled();
    expect(barberCreate).not.toHaveBeenCalled();
    expect(shopMemberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ barberId: null, teamStatus: 'ACTIVE' }),
      }),
    );
  });

  it('links invite Barber to already-member with no seat and normalises NEW to ACTIVE', async () => {
    shopMemberFindUnique.mockResolvedValue({ id: 'm-existing', barberId: null, teamStatus: 'NEW' });
    barberFindFirst.mockResolvedValue({ id: 'b1', userId: null });
    barberUpdate.mockResolvedValue({ id: 'b1' });
    shopMemberUpdate.mockResolvedValue({});
    shopInviteUpdate.mockResolvedValue({});

    const result = await acceptInviteForUser(
      { id: 'inv-3', shopId: 'shop-1', role: 'BARBER', barberId: 'b1' },
      'user-1',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyMember).toBe(true);
    expect(barberUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { userId: 'user-1' },
    });
    expect(shopMemberUpdate).toHaveBeenCalledWith({
      where: { id: 'm-existing' },
      data: { barberId: 'b1', teamStatus: 'ACTIVE' },
    });
    expect(barberCreate).not.toHaveBeenCalled();
  });

  it('normalises existing NEW member to ACTIVE without changing ACTIVE members further', async () => {
    shopMemberFindUnique.mockResolvedValue({
      id: 'm-existing',
      barberId: 'b1',
      teamStatus: 'NEW',
    });
    barberFindFirst.mockResolvedValue({ id: 'b1', userId: 'user-1' });
    shopMemberUpdate.mockResolvedValue({});
    shopInviteUpdate.mockResolvedValue({});

    const result = await acceptInviteForUser(
      { id: 'inv-new', shopId: 'shop-1', role: 'BARBER', barberId: 'b1' },
      'user-1',
    );

    expect(result.ok).toBe(true);
    expect(shopMemberUpdate).toHaveBeenCalledWith({
      where: { id: 'm-existing' },
      data: { teamStatus: 'ACTIVE' },
    });
    expect(barberUpdate).not.toHaveBeenCalled();
  });

  it('is idempotent for existing ACTIVE members', async () => {
    shopMemberFindUnique.mockResolvedValue({
      id: 'm-existing',
      barberId: 'b1',
      teamStatus: 'ACTIVE',
    });
    shopInviteUpdate.mockResolvedValue({});

    const result = await acceptInviteForUser(
      { id: 'inv-active', shopId: 'shop-1', role: 'BARBER', barberId: 'b1' },
      'user-1',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyMember).toBe(true);
    expect(shopMemberUpdate).not.toHaveBeenCalled();
    expect(shopMemberCreate).not.toHaveBeenCalled();
    expect(barberCreate).not.toHaveBeenCalled();
    expect(shopInviteUpdate).toHaveBeenCalled();
  });

  it('refuses a Barber linked to another user', async () => {
    shopMemberFindUnique.mockResolvedValue(null);
    barberFindFirst.mockResolvedValue({ id: 'b1', userId: 'other-user' });

    const result = await acceptInviteForUser(
      { id: 'inv-4', shopId: 'shop-1', role: 'BARBER', barberId: 'b1' },
      'user-1',
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('BOOKING_PROFILE_ALREADY_LINKED');
    expect(shopInviteUpdate).not.toHaveBeenCalled();
    expect(shopMemberCreate).not.toHaveBeenCalled();
  });

  it('is idempotent when Barber.userId already equals the accepting user', async () => {
    shopMemberFindUnique.mockResolvedValue(null);
    barberFindFirst.mockResolvedValue({ id: 'b1', userId: 'user-1' });
    shopMemberCreate.mockResolvedValue({ id: 'm1' });
    shopInviteUpdate.mockResolvedValue({});

    const result = await acceptInviteForUser(
      { id: 'inv-5', shopId: 'shop-1', role: 'BARBER', barberId: 'b1' },
      'user-1',
    );

    expect(result.ok).toBe(true);
    expect(barberUpdate).not.toHaveBeenCalled();
    expect(shopMemberCreate).toHaveBeenCalled();
    expect(shopInviteUpdate).toHaveBeenCalled();
  });

  it('refuses replacing an existing member different barberId', async () => {
    shopMemberFindUnique.mockResolvedValue({
      id: 'm-existing',
      barberId: 'b-other',
      teamStatus: 'ACTIVE',
    });

    const result = await acceptInviteForUser(
      { id: 'inv-6', shopId: 'shop-1', role: 'BARBER', barberId: 'b1' },
      'user-1',
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('MEMBER_BARBER_LINK_CONFLICT');
    expect(shopInviteUpdate).not.toHaveBeenCalled();
  });

  it('leaves invite.acceptedAt unchanged on ownership conflict', async () => {
    shopMemberFindUnique.mockResolvedValue(null);
    barberFindFirst.mockResolvedValue({ id: 'b1', userId: 'other' });

    await acceptInviteForUser(
      { id: 'inv-7', shopId: 'shop-1', role: 'BARBER', barberId: 'b1' },
      'user-1',
    );

    expect(shopInviteUpdate).not.toHaveBeenCalled();
  });
});
