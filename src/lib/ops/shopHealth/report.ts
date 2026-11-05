/**
 * Read side of shop health for the Ops UI (/ops/shops, /ops/shops/[shopId], the preview-request rail card)
 * and GET /api/ops/shops/[shopId]/health. Never runs checks; it only reads stored runs.
 */
import { prisma } from '@/lib/db/client';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';
import { BLACKLINE_SHOP_ID } from '@/lib/demo/products';
import { resolveKersivoProductState, type KersivoProductState } from '@/lib/shop/kersivoAccess';
import { DRAFT_PREVIEW_STATUSES } from './cron';
import { readinessOf, summariseShopHealth, type ShopHealthReadiness } from './overall';
import type { ShopHealthCheckResult, ShopHealthMode, ShopHealthOverall, ShopHealthTrigger } from './types';

export const HISTORY_RUNS = 20;

/** Light order for /ops/shops: red first, then amber, grey, green, then never checked. */
export const OVERALL_SORT: Record<ShopHealthOverall | 'NONE', number> = { RED: 0, AMBER: 1, GREY: 2, GREEN: 3, NONE: 4 };

export const PLAN_LABELS: Record<KersivoProductState, string> = {
  FULL_KERSIVO: 'Full KERSIVO',
  FREE_BOOKING: 'Starter',
  SETUP: 'Setup',
};

export const MODE_LABELS: Record<ShopHealthMode, string> = { LIVE: 'Live', PRELAUNCH: 'Pre-launch' };

export type StoredRun = {
  id: string;
  trigger: ShopHealthTrigger;
  mode: ShopHealthMode;
  overall: ShopHealthOverall;
  startedAt: Date;
  durationMs: number;
  results: ShopHealthCheckResult[];
};

export function parseRunResults(value: unknown): ShopHealthCheckResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is ShopHealthCheckResult =>
      Boolean(r) && typeof r === 'object' && typeof (r as ShopHealthCheckResult).id === 'string' && typeof (r as ShopHealthCheckResult).status === 'string',
  );
}

function toStoredRun(row: {
  id: string;
  trigger: unknown;
  mode: unknown;
  overall: unknown;
  startedAt: Date;
  durationMs: number;
  results: unknown;
}): StoredRun {
  return {
    id: row.id,
    trigger: String(row.trigger) as ShopHealthTrigger,
    mode: String(row.mode) as ShopHealthMode,
    overall: String(row.overall) as ShopHealthOverall,
    startedAt: row.startedAt,
    durationMs: row.durationMs,
    results: parseRunResults(row.results),
  };
}

/**
 * The mode whose runs drive the shop's light: GREY means the shop is still pre-launch, any other stored
 * light means live. Without a stored light, the newest run decides.
 */
export function displayMode(healthOverall: ShopHealthOverall | null, runs: readonly StoredRun[]): ShopHealthMode | null {
  if (healthOverall === 'GREY') return 'PRELAUNCH';
  if (healthOverall) return 'LIVE';
  return runs[0]?.mode ?? null;
}

/** Newest run in the display mode (a launch-guard LIVE run of a draft shop does not replace its GREY report). */
export function pickDisplayRun(healthOverall: ShopHealthOverall | null, runs: readonly StoredRun[]): StoredRun | null {
  const mode = displayMode(healthOverall, runs);
  return runs.find((r) => r.mode === mode) ?? runs[0] ?? null;
}

/** Failing first (critical fails), then warnings, then inconclusive critical checks; titles only. */
export function issueTitles(run: StoredRun | null): { failing: string[]; warnings: string[] } {
  if (!run) return { failing: [], warnings: [] };
  const summary = summariseShopHealth(run.mode, run.results, null);
  const inconclusive = run.results.filter((r) => r.severity === 'critical' && r.status === 'inconclusive');
  return {
    failing: summary.failing.map((r) => r.title),
    warnings: [...summary.warnings, ...inconclusive].map((r) => r.title),
  };
}

export type ShopHealthListRow = {
  shopId: string;
  name: string;
  plan: string;
  mode: ShopHealthMode | null;
  overall: ShopHealthOverall | null;
  checkedAt: Date | null;
  readiness: ShopHealthReadiness | null;
  /** Failing titles first, then warnings. */
  issues: string[];
  failingCount: number;
  previewRequestId: string | null;
};

export function sortShopHealthRows<T extends { overall: ShopHealthOverall | null; checkedAt: Date | null; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const light = OVERALL_SORT[a.overall ?? 'NONE'] - OVERALL_SORT[b.overall ?? 'NONE'];
    if (light) return light;
    const at = a.checkedAt?.getTime() ?? 0;
    const bt = b.checkedAt?.getTime() ?? 0;
    if (at !== bt) return at - bt;
    return a.name.localeCompare(b.name, 'en-GB');
  });
}

export type ShopHealthListFilter = ShopHealthOverall | null;

export function parseShopHealthFilter(value: string | null | undefined): ShopHealthListFilter {
  const upper = (value ?? '').trim().toUpperCase();
  return upper === 'RED' || upper === 'AMBER' || upper === 'GREY' || upper === 'GREEN' ? upper : null;
}

/**
 * Every shop the cron looks after (live or a draft in an active preview request) plus any shop that has
 * ever been checked, excluding the demo shops.
 */
export async function listShopHealthRows(now = new Date()): Promise<ShopHealthListRow[]> {
  const shops = await prisma.shopSettings.findMany({
    where: {
      id: { notIn: [DEMO_SHOP_ID, BLACKLINE_SHOP_ID] },
      OR: [
        { healthCheckedAt: { not: null } },
        {
          departure: null,
          OR: [
            { shopPaidAt: { not: null } },
            { goLiveAt: { not: null } },
            { freeBookingActivatedAt: { not: null } },
            { smsRemindersEnabled: true },
          ],
        },
        { previewRequest: { status: { in: [...DRAFT_PREVIEW_STATUSES] } } },
      ],
    },
    take: 500,
    select: {
      id: true,
      name: true,
      shopPaidAt: true,
      smsRemindersEnabled: true,
      freeBookingActivatedAt: true,
      departure: { select: { status: true } },
      healthOverall: true,
      healthCheckedAt: true,
      previewRequest: { select: { id: true } },
      healthRuns: {
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: { id: true, trigger: true, mode: true, overall: true, startedAt: true, durationMs: true, results: true },
      },
    },
  });
  if (!shops.length) return [];

  const subscriptions = await prisma.saasSubscription.findMany({
    where: { shopId: { in: shops.map((s) => s.id) }, status: { not: 'PENDING' } },
    orderBy: { createdAt: 'desc' },
    select: {
      shopId: true,
      status: true,
      currentPeriodEnd: true,
      pastDueSince: true,
      cancelAtPeriodEnd: true,
      postFullPlan: true,
      postFullTermsVersion: true,
    },
  });
  const latestSub = new Map<string, (typeof subscriptions)[number]>();
  for (const sub of subscriptions) if (sub.shopId && !latestSub.has(sub.shopId)) latestSub.set(sub.shopId, sub);

  const rows = shops.map((shop): ShopHealthListRow => {
    const overall = shop.healthOverall ? (String(shop.healthOverall) as ShopHealthOverall) : null;
    const runs = shop.healthRuns.map(toStoredRun);
    const run = pickDisplayRun(overall, runs);
    const issues = issueTitles(run);
    const state = resolveKersivoProductState(shop, latestSub.get(shop.id) ?? null, now);
    return {
      shopId: shop.id,
      name: shop.name,
      plan: PLAN_LABELS[state],
      mode: displayMode(overall, runs),
      overall,
      checkedAt: shop.healthCheckedAt,
      readiness: run ? readinessOf(run.results) : null,
      issues: [...issues.failing, ...issues.warnings],
      failingCount: issues.failing.length,
      previewRequestId: shop.previewRequest?.id ?? null,
    };
  });
  return sortShopHealthRows(rows);
}

export type ShopHealthHistoryItem = {
  id: string;
  overall: ShopHealthOverall;
  mode: ShopHealthMode;
  trigger: ShopHealthTrigger;
  startedAt: Date;
  failing: string[];
};

export type ShopHealthReport = {
  shopId: string;
  name: string;
  overall: ShopHealthOverall | null;
  checkedAt: Date | null;
  mode: ShopHealthMode | null;
  previewRequestId: string | null;
  latest: (StoredRun & { readiness: ShopHealthReadiness; failingCount: number; warningCount: number }) | null;
  history: ShopHealthHistoryItem[];
};

export async function loadShopHealthReport(shopId: string): Promise<ShopHealthReport | null> {
  const shop = await prisma.shopSettings.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      name: true,
      healthOverall: true,
      healthCheckedAt: true,
      previewRequest: { select: { id: true } },
      healthRuns: {
        orderBy: { startedAt: 'desc' },
        take: HISTORY_RUNS,
        select: { id: true, trigger: true, mode: true, overall: true, startedAt: true, durationMs: true, results: true },
      },
    },
  });
  if (!shop) return null;
  const overall = shop.healthOverall ? (String(shop.healthOverall) as ShopHealthOverall) : null;
  const runs = shop.healthRuns.map(toStoredRun);
  const run = pickDisplayRun(overall, runs);
  const summary = run ? summariseShopHealth(run.mode, run.results, null) : null;
  return {
    shopId: shop.id,
    name: shop.name,
    overall,
    checkedAt: shop.healthCheckedAt,
    mode: displayMode(overall, runs),
    previewRequestId: shop.previewRequest?.id ?? null,
    latest:
      run && summary
        ? { ...run, readiness: summary.readiness, failingCount: summary.failing.length, warningCount: summary.warnings.length }
        : null,
    // Oldest first, so the dots read left to right.
    history: runs
      .map((r) => ({
        id: r.id,
        overall: r.overall,
        mode: r.mode,
        trigger: r.trigger,
        startedAt: r.startedAt,
        failing: issueTitles(r).failing,
      }))
      .reverse(),
  };
}

/** JSON shape for the API (dates as ISO strings). */
export function serialiseShopHealthReport(report: ShopHealthReport) {
  return {
    ...report,
    checkedAt: report.checkedAt?.toISOString() ?? null,
    latest: report.latest ? { ...report.latest, startedAt: report.latest.startedAt.toISOString() } : null,
    history: report.history.map((h) => ({ ...h, startedAt: h.startedAt.toISOString() })),
  };
}
