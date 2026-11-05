import { beforeEach, describe, expect, it, vi } from 'vitest';

const { shopHealthRun } = vi.hoisted(() => ({ shopHealthRun: { findMany: vi.fn(), deleteMany: vi.fn() } }));
vi.mock('@/lib/db/client', () => ({ prisma: { shopHealthRun } }));

import { cronBudgetMs, pruneShopHealthRuns, runShopHealthCron, type DueShop } from './cron';
import type { ShopHealthRunResult } from './run';

const shops = (n: number): DueShop[] =>
  Array.from({ length: n }, (_, i) => ({ id: `shop_${i}`, healthCheckedAt: i ? new Date(i * 1000) : null, kind: 'live' }));

const result = (overall: ShopHealthRunResult['overall'], alert: ShopHealthRunResult['alert'] = 'none') =>
  ({ overall, alert }) as ShopHealthRunResult;

function fakeClock(stepMs: number) {
  let t = 0;
  return { clock: () => t, advance: (ms = stepMs) => (t += ms) };
}

beforeEach(() => vi.clearAllMocks());

describe('cronBudgetMs', () => {
  it('is 80% of maxDuration (default 60 s)', () => {
    expect(cronBudgetMs({})).toBe(48_000);
    expect(cronBudgetMs({ SHOP_HEALTH_CRON_MAX_DURATION_S: '300' })).toBe(240_000);
    expect(cronBudgetMs({ SHOP_HEALTH_CRON_MAX_DURATION_S: 'junk' })).toBe(48_000);
  });
});

describe('runShopHealthCron', () => {
  it('processes shops in the order given (oldest check first) and reports red shops and alerts', async () => {
    const order: string[] = [];
    const run = vi.fn(async (id: string) => {
      order.push(id);
      return id === 'shop_1' ? result('RED', 'alert') : result('GREEN');
    });
    const summary = await runShopHealthCron({ select: async () => shops(3), run, prune: async () => 0, budgetMs: 1e9 });
    expect(order).toEqual(['shop_0', 'shop_1', 'shop_2']);
    expect(summary).toMatchObject({ due: 3, processed: 3, remaining: 0, red: ['shop_1'], alerts: [{ shopId: 'shop_1', action: 'alert' }] });
  });

  it('stops before the budget runs out and leaves the rest for the next hour', async () => {
    const c = fakeClock(0);
    const run = vi.fn(async () => {
      c.advance(12_000);
      return result('GREEN');
    });
    const summary = await runShopHealthCron({ select: async () => shops(10), run, prune: async () => 0, budgetMs: 48_000, clock: c.clock });
    // 12 s per shop: after 3 shops (36 s) a fourth (≈48 s) would cross the budget.
    expect(summary).toMatchObject({ processed: 3, remaining: 7, stoppedForBudget: true });
    expect(summary.durationMs).toBeLessThanOrEqual(48_000);
  });

  it('resume: the next invocation starts from the shops left over (still the oldest)', async () => {
    const c = fakeClock(0);
    const queue = shops(5);
    const checked = new Set<string>();
    const select = async () => queue.filter((s) => !checked.has(s.id));
    const run = vi.fn(async (id: string) => {
      c.advance(20_000);
      checked.add(id);
      return result('GREEN');
    });
    const first = await runShopHealthCron({ select, run, prune: async () => 0, budgetMs: 48_000, clock: c.clock });
    const second = await runShopHealthCron({ select, run, prune: async () => 0, budgetMs: 48_000, clock: c.clock });
    expect(first.processed + second.processed).toBeGreaterThanOrEqual(3);
    expect(run.mock.calls.map((x) => x[0])).toEqual(queue.slice(0, run.mock.calls.length).map((s) => s.id));
  });

  it('a shop whose run throws is recorded, rotated and never stops the cron', async () => {
    const markChecked = vi.fn().mockResolvedValue(undefined);
    const run = vi.fn().mockRejectedValueOnce(new Error('shop missing')).mockResolvedValue(result('GREEN'));
    const summary = await runShopHealthCron({ select: async () => shops(2), run, prune: async () => 0, markChecked, budgetMs: 1e9 });
    expect(summary.errors).toEqual([{ shopId: 'shop_0', error: 'shop missing' }]);
    expect(summary.processed).toBe(2);
    expect(markChecked).toHaveBeenCalledWith('shop_0', expect.any(Date));
  });

  it('prunes each processed shop', async () => {
    const prune = vi.fn().mockResolvedValue(2);
    const summary = await runShopHealthCron({ select: async () => shops(2), run: async () => result('GREEN'), prune, budgetMs: 1e9 });
    expect(prune).toHaveBeenCalledTimes(2);
    expect(summary.pruned).toBe(4);
  });
});

describe('pruneShopHealthRuns', () => {
  it('deletes everything after the newest 50', async () => {
    shopHealthRun.findMany.mockResolvedValue([{ id: 'r51' }, { id: 'r52' }]);
    shopHealthRun.deleteMany.mockResolvedValue({ count: 2 });
    expect(await pruneShopHealthRuns('shop_1')).toBe(2);
    expect(shopHealthRun.findMany).toHaveBeenCalledWith({
      where: { shopId: 'shop_1' },
      orderBy: { startedAt: 'desc' },
      skip: 50,
      select: { id: true },
    });
    expect(shopHealthRun.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['r51', 'r52'] } } });
  });

  it('deletes nothing with 50 or fewer runs', async () => {
    shopHealthRun.findMany.mockResolvedValue([]);
    expect(await pruneShopHealthRuns('shop_1')).toBe(0);
    expect(shopHealthRun.deleteMany).not.toHaveBeenCalled();
  });
});
