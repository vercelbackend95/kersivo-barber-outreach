/**
 * Hourly shop health cron (/api/cron/shop-health):
 *   - live shops (paid / Starter / launched, not departed): a full run with probes when last checked over
 *     ~1 hour ago;
 *   - draft shops linked to a preview request in IN_PROGRESS / READY / CHANGES_REQUESTED: a PRELAUNCH run
 *     once a day.
 * Shops are processed one at a time, oldest healthCheckedAt first (never-checked first). The cron stops
 * starting new shops at ~80% of the function's maxDuration; the rest are picked up next hour because they
 * are still the oldest. Runs beyond the latest 50 per shop are pruned.
 */
import { prisma } from '@/lib/db/client';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { BLACKLINE_SHOP_ID } from '@/lib/demo/products';
import { runShopHealth, type ShopHealthRunResult } from './run';

export const KEEP_RUNS_PER_SHOP = 50;
export const LIVE_INTERVAL_MS = 55 * 60 * 1000;
export const DRAFT_INTERVAL_MS = 23 * 60 * 60 * 1000;
export const DRAFT_PREVIEW_STATUSES = ['IN_PROGRESS', 'READY', 'CHANGES_REQUESTED'] as const;
/** Assumed per-shop duration before any shop has been timed in this invocation. */
export const MIN_SHOP_ESTIMATE_MS = 10_000;

export function cronBudgetMs(env: Record<string, string | undefined> = process.env): number {
  const seconds = Number(env.SHOP_HEALTH_CRON_MAX_DURATION_S);
  const maxDuration = Number.isFinite(seconds) && seconds >= 10 ? seconds : 60;
  return Math.floor(maxDuration * 1000 * 0.8);
}

export type DueShop = { id: string; healthCheckedAt: Date | null; kind: 'live' | 'draft' };

export async function selectDueShops(now: Date, limit = 200): Promise<DueShop[]> {
  const liveCutoff = new Date(now.getTime() - LIVE_INTERVAL_MS);
  const draftCutoff = new Date(now.getTime() - DRAFT_INTERVAL_MS);
  const [live, drafts] = await Promise.all([
    prisma.shopSettings.findMany({
      where: {
        id: { notIn: [DEMO_SHOP_ID, BLACKLINE_SHOP_ID] },
        departure: null,
        OR: [
          { shopPaidAt: { not: null } },
          { goLiveAt: { not: null } },
          { freeBookingActivatedAt: { not: null } },
          { smsRemindersEnabled: true },
        ],
        AND: [{ OR: [{ healthCheckedAt: null }, { healthCheckedAt: { lt: liveCutoff } }] }],
      },
      orderBy: { healthCheckedAt: { sort: 'asc', nulls: 'first' } },
      take: limit,
      select: { id: true, healthCheckedAt: true },
    }),
    prisma.previewRequest.findMany({
      where: {
        status: { in: [...DRAFT_PREVIEW_STATUSES] },
        draftShopId: { not: null },
        draftShop: { OR: [{ healthCheckedAt: null }, { healthCheckedAt: { lt: draftCutoff } }] },
      },
      take: limit,
      select: { draftShop: { select: { id: true, healthCheckedAt: true } } },
    }),
  ]);
  const seen = new Set<string>();
  const out: DueShop[] = [];
  for (const shop of live) {
    seen.add(shop.id);
    out.push({ ...shop, kind: 'live' });
  }
  for (const row of drafts) {
    if (row.draftShop && !seen.has(row.draftShop.id)) {
      seen.add(row.draftShop.id);
      out.push({ ...row.draftShop, kind: 'draft' });
    }
  }
  return out.sort((a, b) => (a.healthCheckedAt?.getTime() ?? 0) - (b.healthCheckedAt?.getTime() ?? 0)).slice(0, limit);
}

/** Deletes runs beyond the latest `keep` for one shop. Returns the number deleted. */
export async function pruneShopHealthRuns(shopId: string, keep = KEEP_RUNS_PER_SHOP): Promise<number> {
  const old = await prisma.shopHealthRun.findMany({
    where: { shopId },
    orderBy: { startedAt: 'desc' },
    skip: keep,
    select: { id: true },
  });
  if (!old.length) return 0;
  const { count } = await prisma.shopHealthRun.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
  return count;
}

export type ShopHealthCronSummary = {
  due: number;
  processed: number;
  remaining: number;
  stoppedForBudget: boolean;
  pruned: number;
  red: string[];
  alerts: Array<{ shopId: string; action: string }>;
  errors: Array<{ shopId: string; error: string }>;
  durationMs: number;
};

export async function runShopHealthCron(options: {
  now?: Date;
  budgetMs?: number;
  clock?: () => number;
  select?: typeof selectDueShops;
  run?: (shopId: string) => Promise<ShopHealthRunResult>;
  prune?: typeof pruneShopHealthRuns;
  markChecked?: (shopId: string, at: Date) => Promise<unknown>;
} = {}): Promise<ShopHealthCronSummary> {
  const clock = options.clock ?? Date.now;
  const started = clock();
  const now = options.now ?? new Date(started);
  const budgetMs = options.budgetMs ?? cronBudgetMs();
  const select = options.select ?? selectDueShops;
  const run = options.run ?? ((shopId: string) => runShopHealth(shopId, { trigger: 'CRON', probes: true, now: new Date(clock()) }));
  const prune = options.prune ?? pruneShopHealthRuns;
  const markChecked =
    options.markChecked ??
    ((shopId: string, at: Date) => prisma.shopSettings.update({ where: { id: shopId }, data: { healthCheckedAt: at } }));

  const due = await select(now);
  const summary: ShopHealthCronSummary = {
    due: due.length,
    processed: 0,
    remaining: 0,
    stoppedForBudget: false,
    pruned: 0,
    red: [],
    alerts: [],
    errors: [],
    durationMs: 0,
  };
  let slowest = MIN_SHOP_ESTIMATE_MS;

  for (const shop of due) {
    const elapsed = clock() - started;
    // Never start a shop that would likely run past the budget.
    if (elapsed + slowest >= budgetMs) {
      summary.stoppedForBudget = true;
      break;
    }
    const shopStarted = clock();
    try {
      const result = await run(shop.id);
      if (result.overall === 'RED') summary.red.push(shop.id);
      if (result.alert !== 'none') summary.alerts.push({ shopId: shop.id, action: result.alert });
    } catch (error) {
      summary.errors.push({ shopId: shop.id, error: error instanceof Error ? error.message : String(error) });
      // Rotate a shop whose run cannot even start, so it never blocks the queue.
      await markChecked(shop.id, new Date(clock())).catch(() => undefined);
    }
    try {
      summary.pruned += await prune(shop.id);
    } catch {
      // Pruning is housekeeping; it retries on the next run.
    }
    summary.processed += 1;
    slowest = Math.max(slowest, clock() - shopStarted);
  }
  summary.remaining = due.length - summary.processed;
  summary.durationMs = clock() - started;
  return summary;
}
