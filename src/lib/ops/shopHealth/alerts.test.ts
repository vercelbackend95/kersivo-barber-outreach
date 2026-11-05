import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enqueueEmailOnce, tryDeliverOutboxEmail, captureOpsMessage, shopSettings, env } = vi.hoisted(() => ({
  enqueueEmailOnce: vi.fn(),
  tryDeliverOutboxEmail: vi.fn(),
  captureOpsMessage: vi.fn(),
  shopSettings: { update: vi.fn() },
  env: { deployment: 'production' as 'production' | 'preview' },
}));

vi.mock('@/lib/db/client', () => ({ prisma: { shopSettings } }));
vi.mock('@/lib/email/outbox', () => ({ enqueueEmailOnce, tryDeliverOutboxEmail }));
vi.mock('@/lib/ops/sentry', () => ({ captureOpsMessage }));
vi.mock('@/lib/email/internalNotificationRecipient', () => ({ resolveDeploymentEnvironment: () => env.deployment }));
vi.mock('@/lib/ops/operatorAuth', () => ({ readOpsEmailAllowlistFromEnv: () => ['ops@kersivo.co.uk', 'founder@kersivo.co.uk'] }));

import { applyShopHealthAlert, buildShopHealthAlertEmail, decideShopHealthAlert } from './alerts';
import type { ShopHealthCheckResult } from './types';

const NOW = new Date('2026-11-04T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const failing: ShopHealthCheckResult[] = [
  { id: 'booking.dry_run', area: 'booking', title: 'Test booking (dry run)', severity: 'critical', status: 'fail', message: 'No <slots>.', fix: 'Add rules.' },
];
const base = { mode: 'LIVE' as const, now: NOW };

describe('decideShopHealthAlert', () => {
  it('anti-flap: a single red run never alerts', () => {
    expect(decideShopHealthAlert({ ...base, overall: 'RED', previousOverall: 'GREEN', alertedAt: null })).toBe('none');
    expect(decideShopHealthAlert({ ...base, overall: 'RED', previousOverall: null, alertedAt: null })).toBe('none');
  });

  it('alerts on the second red run in a row, then stays quiet', () => {
    expect(decideShopHealthAlert({ ...base, overall: 'RED', previousOverall: 'RED', alertedAt: null })).toBe('alert');
    expect(decideShopHealthAlert({ ...base, overall: 'RED', previousOverall: 'RED', alertedAt: hoursAgo(5) })).toBe('none');
  });

  it('reminds at most once per 24 h while still red', () => {
    expect(decideShopHealthAlert({ ...base, overall: 'RED', previousOverall: 'RED', alertedAt: hoursAgo(23.9) })).toBe('none');
    expect(decideShopHealthAlert({ ...base, overall: 'RED', previousOverall: 'RED', alertedAt: hoursAgo(24) })).toBe('reminder');
  });

  it('recovers once when no longer red after an alert', () => {
    expect(decideShopHealthAlert({ ...base, overall: 'GREEN', previousOverall: 'RED', alertedAt: hoursAgo(2) })).toBe('recovery');
    expect(decideShopHealthAlert({ ...base, overall: 'AMBER', previousOverall: 'RED', alertedAt: hoursAgo(2) })).toBe('recovery');
    expect(decideShopHealthAlert({ ...base, overall: 'GREEN', previousOverall: 'RED', alertedAt: null })).toBe('none');
  });

  it('never alerts for drafts', () => {
    expect(decideShopHealthAlert({ ...base, mode: 'PRELAUNCH', overall: 'GREY', previousOverall: 'GREY', alertedAt: null })).toBe('none');
  });
});

describe('buildShopHealthAlertEmail', () => {
  it('escapes check text and names the first failing check in the subject', () => {
    const e = buildShopHealthAlertEmail({ action: 'alert', shopId: 's1', shopName: 'Fade Room', overall: 'RED', failing });
    expect(e.subject).toBe('[KERSIVO] Red: Fade Room — Test booking (dry run)');
    expect(e.html).toContain('No &lt;slots&gt;.');
    expect(e.html).toContain('https://kersivo.co.uk/ops/shops/s1');
  });

  it('writes "Back to green" on recovery', () => {
    expect(buildShopHealthAlertEmail({ action: 'recovery', shopId: 's1', shopName: 'Fade Room', overall: 'GREEN', failing: [] }).subject).toBe(
      '[KERSIVO] Back to green: Fade Room',
    );
  });
});

describe('applyShopHealthAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.deployment = 'production';
    enqueueEmailOnce.mockImplementation(async (input: { to: string }) => ({ row: { id: `out_${input.to}` }, created: true }));
  });

  const input = { shopId: 's1', shopName: 'Fade Room', runId: 'run_9', failing, now: NOW, mode: 'LIVE' as const };

  it('alerts Sentry and every ops email (internal: shopId null), then stamps healthAlertedAt', async () => {
    const action = await applyShopHealthAlert({ ...input, overall: 'RED', previousOverall: 'RED', alertedAt: null });
    expect(action).toBe('alert');
    expect(captureOpsMessage).toHaveBeenCalledWith(
      'Shop health red: Fade Room — Test booking (dry run)',
      expect.objectContaining({ shopId: 's1' }),
    );
    expect(enqueueEmailOnce).toHaveBeenCalledTimes(2);
    expect(enqueueEmailOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: null,
        purpose: 'SHOP_HEALTH_ALERT_INTERNAL',
        to: 'ops@kersivo.co.uk',
        dedupeKey: 'shop-health:s1:alert:run_9:ops@kersivo.co.uk',
        suppressed: false,
      }),
    );
    expect(tryDeliverOutboxEmail).toHaveBeenCalledTimes(2);
    expect(shopSettings.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { healthAlertedAt: NOW } });
  });

  it('records suppressed rows outside Production', async () => {
    env.deployment = 'preview';
    await applyShopHealthAlert({ ...input, overall: 'RED', previousOverall: 'RED', alertedAt: null });
    expect(enqueueEmailOnce).toHaveBeenCalledWith(expect.objectContaining({ suppressed: true, subject: expect.stringMatching(/^\[Preview\] /) }));
  });

  it('de-duplicates: a replayed run does not deliver twice', async () => {
    enqueueEmailOnce.mockResolvedValue({ row: { id: 'out_1' }, created: false });
    await applyShopHealthAlert({ ...input, overall: 'RED', previousOverall: 'RED', alertedAt: null });
    expect(tryDeliverOutboxEmail).not.toHaveBeenCalled();
  });

  it('sends one recovery email and clears healthAlertedAt; no Sentry message', async () => {
    const action = await applyShopHealthAlert({ ...input, overall: 'GREEN', previousOverall: 'RED', alertedAt: hoursAgo(3) });
    expect(action).toBe('recovery');
    expect(captureOpsMessage).not.toHaveBeenCalled();
    expect(shopSettings.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { healthAlertedAt: null } });
  });

  it('does nothing while it stays red within 24 h', async () => {
    expect(await applyShopHealthAlert({ ...input, overall: 'RED', previousOverall: 'RED', alertedAt: hoursAgo(1) })).toBe('none');
    expect(enqueueEmailOnce).not.toHaveBeenCalled();
    expect(shopSettings.update).not.toHaveBeenCalled();
  });
});
