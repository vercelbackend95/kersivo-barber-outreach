import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const getSession = vi.fn();
const findManyMembers = vi.fn();
const countOwners = vi.fn();
const findManySubs = vi.fn();
const findFirstAccount = vi.fn();
const verifyPassword = vi.fn();
const recordAccountLifecycleEvent = vi.fn();
const transaction = vi.fn();
const cookieSet = vi.fn();

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSession(...args),
    },
  },
}));

vi.mock('better-auth/crypto', () => ({
  verifyPassword: (...args: unknown[]) => verifyPassword(...args),
}));

vi.mock('@/lib/setup/accountLifecycleAudit', () => ({
  ACCOUNT_LIFECYCLE_ACTIONS: {
    ACCOUNT_DELETE_BLOCKED: 'ACCOUNT_DELETE_BLOCKED',
    ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  },
  recordAccountLifecycleEvent: (...args: unknown[]) => recordAccountLifecycleEvent(...args),
}));

vi.mock('@/lib/admin/session', () => ({
  getAdminSessionCookieName: () => 'admin_session',
  getAdminSessionCookieOptions: () => ({}),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopMember: {
      findMany: (...args: unknown[]) => findManyMembers(...args),
      count: (...args: unknown[]) => countOwners(...args),
    },
    saasSubscription: {
      findMany: (...args: unknown[]) => findManySubs(...args),
    },
    account: {
      findFirst: (...args: unknown[]) => findFirstAccount(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

import { DELETE, GET } from './index';

function makeDeleteContext(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    cookies: { set: cookieSet },
  } as unknown as APIContext;
}

function makeGetContext(): APIContext {
  return {
    request: new Request('http://localhost/api/admin/account', { method: 'GET' }),
  } as unknown as APIContext;
}

describe('/api/admin/account', () => {
  beforeEach(() => {
    getSession.mockReset();
    findManyMembers.mockReset();
    countOwners.mockReset();
    findManySubs.mockReset();
    findFirstAccount.mockReset();
    verifyPassword.mockReset();
    recordAccountLifecycleEvent.mockReset();
    transaction.mockReset();
    cookieSet.mockReset();
  });

  it('GET returns deletionBlocked for ACTIVE sole-owner shop', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'o@example.com' } });
    findManyMembers.mockResolvedValue([{ shopId: 'shop-1' }]);
    countOwners.mockResolvedValue(0);
    findManySubs.mockResolvedValue([
      {
        shopId: 'shop-1',
        status: 'ACTIVE',
        stripeSubscriptionId: 'sub_1',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      },
    ]);
    findFirstAccount.mockResolvedValue({ id: 'acc1' });

    const res = await GET(makeGetContext() as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deletionBlocked).toBe(true);
    expect(body.hasPasswordCredential).toBe(true);
  });

  it('DELETE returns 400 without confirm DELETE', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'o@example.com' } });
    const res = await DELETE(makeDeleteContext({ confirm: 'nope' }) as never);
    expect(res.status).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('DELETE returns 401 for wrong password', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'o@example.com' } });
    findFirstAccount.mockResolvedValue({ password: 'hashed' });
    verifyPassword.mockResolvedValue(false);

    const res = await DELETE(
      makeDeleteContext({ confirm: 'DELETE', password: 'wrong' }) as never,
    );
    expect(res.status).toBe(401);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('DELETE returns 409 when subscription blocks deletion', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'o@example.com' } });
    findFirstAccount.mockResolvedValue({ password: 'hashed' });
    verifyPassword.mockResolvedValue(true);
    findManyMembers.mockResolvedValue([{ shopId: 'shop-1' }]);
    countOwners.mockResolvedValue(0);
    findManySubs.mockResolvedValue([
      {
        shopId: 'shop-1',
        status: 'ACTIVE',
        stripeSubscriptionId: 'sub_1',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);

    const res = await DELETE(
      makeDeleteContext({ confirm: 'DELETE', password: 'secret' }) as never,
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('SUBSCRIPTION_BLOCKS_DELETE');
    expect(transaction).not.toHaveBeenCalled();
    expect(recordAccountLifecycleEvent).toHaveBeenCalled();
  });

  it('DELETE proceeds when CANCELED and password ok', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'o@example.com' } });
    findFirstAccount.mockResolvedValue({ password: 'hashed' });
    verifyPassword.mockResolvedValue(true);
    findManyMembers.mockResolvedValue([{ shopId: 'shop-1' }]);
    countOwners.mockResolvedValue(0);
    findManySubs.mockResolvedValue([
      {
        shopId: 'shop-1',
        status: 'CANCELED',
        stripeSubscriptionId: 'sub_1',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      },
    ]);
    transaction.mockResolvedValue(undefined);

    const res = await DELETE(
      makeDeleteContext({ confirm: 'DELETE', password: 'secret' }) as never,
    );
    expect(res.status).toBe(200);
    expect(transaction).toHaveBeenCalled();
  });
});
