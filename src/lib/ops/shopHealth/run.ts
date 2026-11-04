/**
 * runShopHealth: load the context once, run every check with a per-check timeout, compute the light,
 * store a ShopHealthRun and the denormalised ShopSettings.health* fields. A check that throws or times out
 * is "inconclusive"; the run itself never throws for a check.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { CONFIG_CHECKS } from './checks/config';
import { bookingAvailability, bookingDryRun } from './checks/bookingProbe';
import { loadShopHealthContext, naturalHealthMode } from './context';
import { summariseShopHealth, type ShopHealthSummary } from './overall';
import type {
  ShopHealthCheck,
  ShopHealthCheckResult,
  ShopHealthContext,
  ShopHealthMode,
  ShopHealthTrigger,
} from './types';

export const CHECK_TIMEOUT_MS = 10_000;

/** Every check, in display order inside each area. H2 appends the HTTP / Stripe probes. */
export const SHOP_HEALTH_CHECKS: ShopHealthCheck[] = [...CONFIG_CHECKS, bookingAvailability, bookingDryRun];

class CheckTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new CheckTimeoutError(`timed out after ${ms / 1000} s`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function runCheck(
  check: ShopHealthCheck,
  ctx: ShopHealthContext,
  timeoutMs = CHECK_TIMEOUT_MS,
): Promise<ShopHealthCheckResult> {
  const base = { id: check.id, area: check.area, title: check.title, severity: check.severity };
  let applies;
  try {
    applies = check.appliesWhen(ctx);
  } catch (error) {
    return { ...base, status: 'inconclusive', message: `The check could not start: ${errorText(error)}.` };
  }
  if (applies === 'no') return { ...base, status: 'skip', message: 'Does not apply to this shop.' };
  if (applies === 'after_launch') return { ...base, status: 'after_launch', message: 'Checked after launch.' };
  try {
    const outcome = await withTimeout(Promise.resolve().then(() => check.run(ctx)), timeoutMs);
    return { ...base, ...outcome };
  } catch (error) {
    return {
      ...base,
      status: 'inconclusive',
      message:
        error instanceof CheckTimeoutError
          ? `The check did not finish in ${timeoutMs / 1000} seconds.`
          : `The check could not finish: ${errorText(error)}.`,
    };
  }
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

export type RunShopHealthOptions = {
  trigger: ShopHealthTrigger;
  /** Include probe checks (dry-run booking, availability, HTTP, Stripe). False = config checks only. */
  probes: boolean;
  /** Force a mode (the launch guard runs a draft shop in LIVE mode). */
  mode?: ShopHealthMode;
  /** Store the run (default true). Page-load config runs pass false. */
  persist?: boolean;
  now?: Date;
  checks?: readonly ShopHealthCheck[];
};

export type ShopHealthRunResult = ShopHealthSummary & {
  runId: string | null;
  shopId: string;
  trigger: ShopHealthTrigger;
  mode: ShopHealthMode;
  results: ShopHealthCheckResult[];
  startedAt: Date;
  durationMs: number;
};

export async function loadPreviousResults(shopId: string): Promise<ShopHealthCheckResult[] | null> {
  const previous = await prisma.shopHealthRun.findFirst({
    where: { shopId },
    orderBy: { startedAt: 'desc' },
    select: { results: true },
  });
  return Array.isArray(previous?.results) ? (previous!.results as unknown as ShopHealthCheckResult[]) : null;
}

export async function runShopHealth(shopId: string, options: RunShopHealthOptions): Promise<ShopHealthRunResult> {
  const startedAt = options.now ?? new Date();
  const started = Date.now();
  const ctx = await loadShopHealthContext(shopId, { now: startedAt, mode: options.mode });
  const checks = (options.checks ?? SHOP_HEALTH_CHECKS).filter((c) => options.probes || c.kind === 'config');

  const results: ShopHealthCheckResult[] = [];
  for (const check of checks) results.push(await runCheck(check, ctx));

  const persist = options.persist !== false;
  const previous = persist ? await loadPreviousResults(shopId) : null;
  const summary = summariseShopHealth(ctx.mode, results, previous);
  const durationMs = Date.now() - started;

  let runId: string | null = null;
  if (persist) {
    const run = await prisma.shopHealthRun.create({
      data: {
        shopId,
        trigger: options.trigger,
        mode: ctx.mode,
        overall: summary.overall,
        results: results as unknown as Prisma.InputJsonValue,
        startedAt,
        durationMs,
      },
      select: { id: true },
    });
    runId = run.id;
    // The list light follows the shop's own mode only: a launch-guard LIVE run of a draft shop is
    // stored as a run but does not turn the draft red in /ops/shops.
    if (ctx.mode === naturalHealthMode(ctx.access, ctx.shop)) {
      await prisma.shopSettings.update({
        where: { id: shopId },
        data: { healthOverall: summary.overall, healthCheckedAt: startedAt },
      });
    }
  }

  return { ...summary, runId, shopId, trigger: options.trigger, mode: ctx.mode, results, startedAt, durationMs };
}
