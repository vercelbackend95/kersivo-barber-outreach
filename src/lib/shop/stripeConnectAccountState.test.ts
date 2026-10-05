import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMany = vi.fn();
const findFirst = vi.fn();

vi.mock('../db/client', () => ({
  prisma: {
    shopSettings: {
      updateMany: (...args: unknown[]) => updateMany(...args),
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
  },
}));

import {
  applyConnectAccountDeauthorized,
  applyConnectAccountUpdated,
} from './stripeConnectAccountState';

describe('Stripe Connect account state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks a deauthorized current account unusable without clearing its account id', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const eventAt = new Date('2026-10-05T11:00:00.000Z');

    const result = await applyConnectAccountDeauthorized({
      accountId: 'acct_standard',
      eventAt,
    });

    expect(result).toEqual({ shopsUpdated: 1, ignored: null });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        stripeConnectAccountId: 'acct_standard',
        OR: [{ connectStatusEventAt: null }, { connectStatusEventAt: { lte: eventAt } }],
      },
      data: {
        stripeConnectChargesEnabled: false,
        stripeConnectDetailsSubmitted: false,
        stripeConnectDisconnectedAt: eventAt,
        connectStatusEventAt: eventAt,
      },
    });
  });

  it('account.updated only applies while the current connection is not deauthorized', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const eventAt = new Date('2026-10-05T11:01:00.000Z');

    await applyConnectAccountUpdated({
      accountId: 'acct_standard',
      chargesEnabled: true,
      detailsSubmitted: true,
      eventAt,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        stripeConnectAccountId: 'acct_standard',
        stripeConnectDisconnectedAt: null,
        OR: [{ connectStatusEventAt: null }, { connectStatusEventAt: { lte: eventAt } }],
      },
      data: {
        stripeConnectChargesEnabled: true,
        stripeConnectDetailsSubmitted: true,
        connectStatusEventAt: eventAt,
      },
    });
  });

  it('does not revive an account that is already marked deauthorized', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue({
      stripeConnectDisconnectedAt: new Date('2026-10-05T11:00:00.000Z'),
    });

    const result = await applyConnectAccountUpdated({
      accountId: 'acct_standard',
      chargesEnabled: true,
      detailsSubmitted: true,
      eventAt: new Date('2026-10-05T11:02:00.000Z'),
    });

    expect(result).toEqual({ shopsUpdated: 0, ignored: 'deauthorized_account' });
  });

  it('reports unknown account instead of mutating unrelated shops', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue(null);

    await expect(
      applyConnectAccountDeauthorized({
        accountId: 'acct_unknown',
        eventAt: new Date('2026-10-05T11:00:00.000Z'),
      }),
    ).resolves.toEqual({ shopsUpdated: 0, ignored: 'unknown_account' });
  });

  it('ignores stale deauthorization events for a known account', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue({ stripeConnectDisconnectedAt: null });

    await expect(
      applyConnectAccountDeauthorized({
        accountId: 'acct_standard',
        eventAt: new Date('2026-10-05T10:00:00.000Z'),
      }),
    ).resolves.toEqual({ shopsUpdated: 0, ignored: 'stale_event' });
  });
});
