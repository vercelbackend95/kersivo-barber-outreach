import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recordAccountLifecycleEvent, loadKersivoAccess } = vi.hoisted(() => ({
  recordAccountLifecycleEvent: vi.fn(),
  loadKersivoAccess: vi.fn(),
}));

vi.mock('@/lib/ops/opsLog', () => ({ opsLogError: vi.fn() }));
vi.mock('@/lib/shop/kersivoAccess', () => ({
  loadKersivoAccess: (...a: unknown[]) => loadKersivoAccess(...a),
}));
vi.mock('./accountLifecycleAudit', () => ({
  ACCOUNT_LIFECYCLE_ACTIONS: {
    STARTER_STRIPE_READY: 'STARTER_STRIPE_READY',
    STARTER_STRIPE_PAUSED: 'STARTER_STRIPE_PAUSED',
  },
  recordAccountLifecycleEvent: (...a: unknown[]) => recordAccountLifecycleEvent(...a),
}));

import { recordStarterStripeTransition, resolveStarterStripeTransition } from './starterStripeTransitions';

/** One shop row shared by the settings refresh and the webhook, each reading `before` then persisting. */
function shopRow(chargesEnabled: boolean) {
  const row = { chargesEnabled, disconnected: false };
  return {
    row,
    async apply(source: string, next: { chargesEnabled: boolean; disconnected: boolean }) {
      const transition = resolveStarterStripeTransition({
        accountType: 'STANDARD',
        before: { ...row },
        after: next,
      });
      Object.assign(row, next);
      if (transition) await recordStarterStripeTransition(source, 'shop_1', transition);
    },
  };
}

const actions = () => recordAccountLifecycleEvent.mock.calls.map(([event]) => (event as { action: string }).action);

describe('Starter Stripe transitions across settings refresh and webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadKersivoAccess.mockResolvedValue({ state: 'FREE_BOOKING' });
  });

  it('settings applies not-ready -> ready, then the ready webhook arrives: exactly one READY', async () => {
    const shop = shopRow(false);
    await shop.apply('settings_refresh', { chargesEnabled: true, disconnected: false });
    await shop.apply('account.updated', { chargesEnabled: true, disconnected: false });
    expect(actions()).toEqual(['STARTER_STRIPE_READY']);
  });

  it('settings applies ready -> not ready, then the webhook arrives: exactly one PAUSED', async () => {
    const shop = shopRow(true);
    await shop.apply('settings_refresh', { chargesEnabled: false, disconnected: false });
    await shop.apply('account.updated', { chargesEnabled: false, disconnected: false });
    expect(actions()).toEqual(['STARTER_STRIPE_PAUSED']);
  });

  it('settings revokes access, then the deauthorized webhook arrives: exactly one PAUSED', async () => {
    const shop = shopRow(true);
    await shop.apply('settings_refresh', { chargesEnabled: false, disconnected: true });
    await shop.apply('account.application.deauthorized', { chargesEnabled: false, disconnected: true });
    expect(recordAccountLifecycleEvent.mock.calls).toEqual([
      [
        {
          action: 'STARTER_STRIPE_PAUSED',
          shopId: 'shop_1',
          meta: { reason: 'disconnected', accountType: 'STANDARD' },
        },
      ],
    ]);
  });

  it('Express is never Standard-ready', () => {
    expect(
      resolveStarterStripeTransition({
        accountType: 'EXPRESS',
        before: { chargesEnabled: false, disconnected: false },
        after: { chargesEnabled: true, disconnected: false },
      }),
    ).toBeNull();
  });

  it('excludes Full and never throws when recording fails', async () => {
    const transition = resolveStarterStripeTransition({
      accountType: 'STANDARD',
      before: { chargesEnabled: false, disconnected: false },
      after: { chargesEnabled: true, disconnected: false },
    })!;
    loadKersivoAccess.mockResolvedValueOnce({ state: 'FULL_KERSIVO' });
    await recordStarterStripeTransition('settings_refresh', 'shop_1', transition);
    expect(recordAccountLifecycleEvent).not.toHaveBeenCalled();

    loadKersivoAccess.mockRejectedValueOnce(new Error('db down'));
    await expect(recordStarterStripeTransition('settings_refresh', 'shop_1', transition)).resolves.toBeUndefined();
  });
});
