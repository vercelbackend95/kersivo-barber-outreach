/**
 * The light. LIVE:
 *   RED   — any applicable critical check failed.
 *   AMBER — any warn, any warning-level fail, or a critical check inconclusive on two runs in a row.
 *   GREEN — otherwise.
 * "inconclusive" alone never turns a shop red. Info checks are shown but never change the light.
 * PRELAUNCH: always GREY, with readiness "x / y" over the checks that apply before launch.
 */
import type { ShopHealthCheckResult, ShopHealthMode, ShopHealthOverall } from './types';

export type ShopHealthReadiness = { ready: number; total: number };

export type ShopHealthSummary = {
  overall: ShopHealthOverall;
  readiness: ShopHealthReadiness;
  /** Critical failures first, then warnings (titles), for lists and alerts. */
  failing: ShopHealthCheckResult[];
  warnings: ShopHealthCheckResult[];
};

/** Critical checks inconclusive now and in the previous run. */
export function repeatedInconclusive(
  results: readonly ShopHealthCheckResult[],
  previous: readonly ShopHealthCheckResult[] | null | undefined,
): ShopHealthCheckResult[] {
  if (!previous?.length) return [];
  const before = new Map(previous.map((r) => [r.id, r.status]));
  return results.filter((r) => r.severity === 'critical' && r.status === 'inconclusive' && before.get(r.id) === 'inconclusive');
}

export function readinessOf(results: readonly ShopHealthCheckResult[]): ShopHealthReadiness {
  const counted = results.filter(
    (r) => r.severity !== 'info' && r.status !== 'skip' && r.status !== 'after_launch',
  );
  return { ready: counted.filter((r) => r.status === 'pass' || r.status === 'warn').length, total: counted.length };
}

export function summariseShopHealth(
  mode: ShopHealthMode,
  results: readonly ShopHealthCheckResult[],
  previous?: readonly ShopHealthCheckResult[] | null,
): ShopHealthSummary {
  const relevant = results.filter((r) => r.severity !== 'info');
  const failing = relevant.filter((r) => r.severity === 'critical' && r.status === 'fail');
  const repeated = repeatedInconclusive(results, previous);
  const warnings = [
    ...relevant.filter((r) => r.status === 'warn' || (r.severity === 'warning' && r.status === 'fail')),
    ...repeated,
  ];
  const readiness = readinessOf(results);
  if (mode === 'PRELAUNCH') return { overall: 'GREY', readiness, failing, warnings };
  const overall: ShopHealthOverall = failing.length ? 'RED' : warnings.length ? 'AMBER' : 'GREEN';
  return { overall, readiness, failing, warnings };
}

export const OVERALL_LABELS: Record<ShopHealthOverall, string> = {
  GREEN: 'Green — all checks passed',
  AMBER: 'Amber — works, needs attention',
  RED: 'Red — something critical is broken',
  GREY: 'Not live yet',
};

/** Fixed footnote shown wherever results are shown. */
export const SHOP_HEALTH_FOOTNOTE =
  'Checks run every hour and on demand. Not covered: real card payments, SMS delivery to the handset (only the provider’s status), and how the site looks on each device.';
