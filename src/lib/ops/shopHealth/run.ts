/**
 * runShopHealth: load the context once, run every check with a per-check timeout, compute the light,
 * store a ShopHealthRun and the denormalised ShopSettings.health* fields. A check that throws or times out
 * is "inconclusive"; the run itself never throws for a check.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { CONFIG_CHECKS } from './checks/config';
import { bookingAvailability, bookingDryRun } from './checks/bookingProbe';
import { PROBE_CHECKS } from './checks/probes';
import { applyShopHealthAlert, type ShopHealthAlertAction } from './alerts';
import { loadShopHealthContext, naturalHealthMode } from './context';
import { summariseShopHealth, type ShopHealthSummary } from './overall';
import type {
  ShopHealthCheck,
  ShopHealthCheckResult,
  ShopHealthContext,
  ShopHealthMode,
  ShopHealthOverall,
  ShopHealthTrigger,
} from './types';

export const CHECK_TIMEOUT_MS = 10_000;

/** Every check, in display order inside each area. */
export const SHOP_HEALTH_CHECKS: ShopHealthCheck[] = [...CONFIG_CHECKS, bookingAvailability, bookingDryRun, ...PROBE_CHECKS];

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

/** Key-shaped strings (Stripe sk_/rk_/pk_, webhook secrets, bearer tokens) never reach stored results or the UI. */
export function redactSecrets(text: string): string {
  return text
    .replace(/'?\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9*]+'?/g, '[Stripe key]')
    .replace(/\bwhsec_[A-Za-z0-9*]+/g, '[webhook secret]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [token]');
}

function errorText(error: unknown): string {
  // Callers add the full stop, so drop the error's own trailing punctuation.
  const text = redactSecrets(error instanceof Error ? error.message : String(error)).trim().replace(/[.!?]+$/, '');
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
  /** Send ops alerts for LIVE shops (default: true for stored runs, except LAUNCH). */
  alerts?: boolean;
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
  previousOverall: ShopHealthOverall | null;
  alert: ShopHealthAlertAction;
};

/** The latest stored run in the same mode (a launch-guard LIVE run never counts for a PRELAUNCH shop). */
export async function loadPreviousRun(
  shopId: string,
  mode: ShopHealthMode,
): Promise<{ results: ShopHealthCheckResult[] | null; overall: ShopHealthOverall | null }> {
  const previous = await prisma.shopHealthRun.findFirst({
    where: { shopId, mode },
    orderBy: { startedAt: 'desc' },
    select: { results: true, overall: true },
  });
  return {
    results: Array.isArray(previous?.results) ? (previous!.results as unknown as ShopHealthCheckResult[]) : null,
    overall: previous ? (String(previous.overall) as ShopHealthOverall) : null,
  };
}

export async function runShopHealth(shopId: string, options: RunShopHealthOptions): Promise<ShopHealthRunResult> {
  const startedAt = options.now ?? new Date();
  const started = Date.now();
  const ctx = await loadShopHealthContext(shopId, { now: startedAt, mode: options.mode });
  const checks = (options.checks ?? SHOP_HEALTH_CHECKS).filter((c) => options.probes || c.kind === 'config');

  const results: ShopHealthCheckResult[] = [];
  for (const check of checks) results.push(await runCheck(check, ctx));

  const persist = options.persist !== false;
  const previous = persist ? await loadPreviousRun(shopId, ctx.mode) : { results: null, overall: null };
  const summary = summariseShopHealth(ctx.mode, results, previous.results);
  const durationMs = Date.now() - started;

  let runId: string | null = null;
  let alert: ShopHealthAlertAction = 'none';
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
      const updated = await prisma.shopSettings.update({
        where: { id: shopId },
        data: { healthOverall: summary.overall, healthCheckedAt: startedAt },
        select: { healthAlertedAt: true },
      });
      if (options.alerts ?? options.trigger !== 'LAUNCH') {
        try {
          alert = await applyShopHealthAlert({
            shopId,
            shopName: ctx.shop.name,
            runId,
            mode: ctx.mode,
            overall: summary.overall,
            previousOverall: previous.overall,
            alertedAt: updated.healthAlertedAt,
            failing: summary.failing,
            now: startedAt,
          });
        } catch (error) {
          // An alert failure never loses the run; the next run tries again (healthAlertedAt unchanged).
          console.error('[shop-health] alert failed', error instanceof Error ? error.message : error);
        }
      }
    }
  }

  return {
    ...summary,
    runId,
    shopId,
    trigger: options.trigger,
    mode: ctx.mode,
    results,
    startedAt,
    durationMs,
    previousOverall: previous.overall,
    alert,
  };
}
