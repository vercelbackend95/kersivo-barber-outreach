import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadShopHealthContext, shopHealthRun, shopSettings, applyShopHealthAlert } = vi.hoisted(() => ({
  loadShopHealthContext: vi.fn(),
  applyShopHealthAlert: vi.fn(),
  shopHealthRun: { findFirst: vi.fn(), create: vi.fn() },
  shopSettings: { update: vi.fn() },
}));

vi.mock('@/lib/db/client', () => ({ prisma: { shopHealthRun, shopSettings } }));
vi.mock('./alerts', () => ({ applyShopHealthAlert: (...args: unknown[]) => applyShopHealthAlert(...args) }));
vi.mock('./context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./context')>()),
  loadShopHealthContext: (...args: unknown[]) => loadShopHealthContext(...args),
}));

import { healthyContext } from './fixtures';
import { redactSecrets, runCheck, runShopHealth } from './run';
import type { ShopHealthCheck } from './types';

const check = (overrides: Partial<ShopHealthCheck>): ShopHealthCheck => ({
  id: 'x.check',
  area: 'booking',
  title: 'X',
  severity: 'critical',
  kind: 'config',
  appliesWhen: () => 'yes',
  run: () => ({ status: 'pass', message: 'ok' }),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  shopHealthRun.findFirst.mockResolvedValue(null);
  shopHealthRun.create.mockResolvedValue({ id: 'run_1' });
  shopSettings.update.mockResolvedValue({ healthAlertedAt: null });
  applyShopHealthAlert.mockResolvedValue('none');
});

describe('runCheck', () => {
  it('never stores key fragments from a thrown error (Stripe masks most of the key, not all)', async () => {
    const message = "The provided key 'sk_test_****************xxkL1W' does not have access to account 'acct_1'";
    const r = await runCheck(check({ run: () => { throw new Error(message); } }), healthyContext());
    expect(r.message).toBe("The check could not finish: The provided key [Stripe key] does not have access to account 'acct_1'.");
    expect(redactSecrets('rk_live_abc whsec_def Bearer abc.def')).toBe('[Stripe key] [webhook secret] Bearer [token]');
  });

  it('turns a thrown check into inconclusive', async () => {
    const r = await runCheck(check({ run: () => { throw new Error('db down'); } }), healthyContext());
    expect(r).toMatchObject({ status: 'inconclusive', message: 'The check could not finish: db down.' });
  });

  it('times out a slow check', async () => {
    const r = await runCheck(check({ run: () => new Promise(() => {}) }), healthyContext(), 20);
    expect(r.status).toBe('inconclusive');
    expect(r.message).toMatch(/did not finish/);
  });

  it('maps applies "no" / "after_launch" to skip / after_launch without running', async () => {
    const run = vi.fn();
    expect((await runCheck(check({ appliesWhen: () => 'no', run }), healthyContext())).status).toBe('skip');
    expect((await runCheck(check({ appliesWhen: () => 'after_launch', run }), healthyContext())).status).toBe('after_launch');
    expect(run).not.toHaveBeenCalled();
  });
});

describe('runShopHealth', () => {
  it('runs config checks only without probes, stores the run and the light', async () => {
    loadShopHealthContext.mockResolvedValue(healthyContext());
    const probe = vi.fn().mockResolvedValue({ status: 'fail', message: 'probe' });
    const result = await runShopHealth('shop_1', {
      trigger: 'MANUAL',
      probes: false,
      checks: [check({}), check({ id: 'p', kind: 'probe', run: probe })],
    });
    expect(probe).not.toHaveBeenCalled();
    expect(result.overall).toBe('GREEN');
    expect(shopHealthRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ shopId: 'shop_1', trigger: 'MANUAL', mode: 'LIVE', overall: 'GREEN' }) }),
    );
    expect(shopSettings.update).toHaveBeenCalledWith({
      where: { id: 'shop_1' },
      data: { healthOverall: 'GREEN', healthCheckedAt: expect.any(Date) },
      select: { healthAlertedAt: true },
    });
    expect(applyShopHealthAlert).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run_1', overall: 'GREEN', previousOverall: null }));
  });

  it('compares with the previous run in the same mode and passes its light to the alert step', async () => {
    loadShopHealthContext.mockResolvedValue(healthyContext());
    shopHealthRun.findFirst.mockResolvedValue({ results: [], overall: 'RED' });
    shopSettings.update.mockResolvedValue({ healthAlertedAt: new Date('2026-11-04T08:00:00Z') });
    await runShopHealth('shop_1', { trigger: 'CRON', probes: false, checks: [check({ run: () => ({ status: 'fail', message: 'x' }) })] });
    expect(shopHealthRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { shopId: 'shop_1', mode: 'LIVE' } }));
    expect(applyShopHealthAlert).toHaveBeenCalledWith(
      expect.objectContaining({ overall: 'RED', previousOverall: 'RED', alertedAt: new Date('2026-11-04T08:00:00Z') }),
    );
  });

  it('an alert failure never loses the run', async () => {
    loadShopHealthContext.mockResolvedValue(healthyContext());
    applyShopHealthAlert.mockRejectedValueOnce(new Error('smtp down'));
    const result = await runShopHealth('shop_1', { trigger: 'CRON', probes: false, checks: [check({})] });
    expect(result.runId).toBe('run_1');
  });

  it('a check that throws never crashes the run', async () => {
    loadShopHealthContext.mockResolvedValue(healthyContext());
    const result = await runShopHealth('shop_1', {
      trigger: 'CRON',
      probes: true,
      checks: [check({ run: () => { throw new Error('boom'); } }), check({ id: 'ok' })],
    });
    expect(result.results.map((r) => r.status)).toEqual(['inconclusive', 'pass']);
    expect(result.overall).toBe('GREEN');
  });

  it('uses the previous run for the two-in-a-row inconclusive rule', async () => {
    loadShopHealthContext.mockResolvedValue(healthyContext());
    shopHealthRun.findFirst.mockResolvedValue({
      results: [{ id: 'x.check', area: 'booking', title: 'X', severity: 'critical', status: 'inconclusive', message: '' }],
    });
    const result = await runShopHealth('shop_1', { trigger: 'CRON', probes: true, checks: [check({ run: () => { throw new Error('x'); } })] });
    expect(result.overall).toBe('AMBER');
  });

  it('a launch-guard LIVE run of a draft shop is stored but does not change the list light', async () => {
    // Draft shop: SETUP, no goLiveAt → natural mode PRELAUNCH; forced into LIVE.
    loadShopHealthContext.mockResolvedValue(
      healthyContext({ mode: 'LIVE', access: { state: 'SETUP', capabilities: [] }, shop: { goLiveAt: null } }),
    );
    const result = await runShopHealth('shop_1', {
      trigger: 'LAUNCH',
      probes: false,
      mode: 'LIVE',
      checks: [check({ run: () => ({ status: 'fail', message: 'no' }) })],
    });
    expect(result.overall).toBe('RED');
    expect(shopHealthRun.create).toHaveBeenCalled();
    expect(shopSettings.update).not.toHaveBeenCalled();
    expect(applyShopHealthAlert).not.toHaveBeenCalled();
  });

  it('persist: false stores nothing', async () => {
    loadShopHealthContext.mockResolvedValue(healthyContext({ mode: 'PRELAUNCH' }));
    const result = await runShopHealth('shop_1', { trigger: 'MANUAL', probes: false, persist: false, checks: [check({})] });
    expect(result).toMatchObject({ overall: 'GREY', runId: null, readiness: { ready: 1, total: 1 } });
    expect(shopHealthRun.create).not.toHaveBeenCalled();
    expect(shopSettings.update).not.toHaveBeenCalled();
  });
});
