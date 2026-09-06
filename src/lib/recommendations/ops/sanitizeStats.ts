import type { RecommendationSetStats } from '@/lib/recommendations/contracts';

const NUMBER_KEYS = [
  'serviceCount',
  'productCount',
  'itemCount',
  'rerankEligibleServiceCount',
  'rerankAttemptedServiceCount',
  'rerankAppliedServiceCount',
  'rerankFallbackServiceCount',
  'rerankSkippedInsufficientCandidatesCount',
] as const;

/** Stable UPPER_SNAKE reason/error codes only. */
const STABLE_REASON_KEY = /^[A-Z][A-Z0-9_]{0,63}$/;
const MAX_REASON_KEYS = 32;

function asNonNegInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

function asReasonCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key !== 'string' || !STABLE_REASON_KEY.test(key)) continue;
    out[key] = asNonNegInt(raw);
    if (Object.keys(out).length >= MAX_REASON_KEYS) break;
  }
  return out;
}

/** Whitelist and coerce RecommendationSet.stats JSON for ops responses. */
export function sanitizeRecommendationSetStats(raw: unknown): RecommendationSetStats | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const stats = {
    serviceCount: asNonNegInt(obj.serviceCount),
    productCount: asNonNegInt(obj.productCount),
    itemCount: asNonNegInt(obj.itemCount),
    rerankEligibleServiceCount: asNonNegInt(obj.rerankEligibleServiceCount),
    rerankAttemptedServiceCount: asNonNegInt(obj.rerankAttemptedServiceCount),
    rerankAppliedServiceCount: asNonNegInt(obj.rerankAppliedServiceCount),
    rerankFallbackServiceCount: asNonNegInt(obj.rerankFallbackServiceCount),
    rerankSkippedInsufficientCandidatesCount: asNonNegInt(
      obj.rerankSkippedInsufficientCandidatesCount,
    ),
    rerankFallbackReasonCounts: asReasonCounts(obj.rerankFallbackReasonCounts),
  } satisfies RecommendationSetStats;

  // If the payload had none of the expected keys, treat as absent rather than all-zero noise.
  const hadAny = NUMBER_KEYS.some((k) => k in obj) || 'rerankFallbackReasonCounts' in obj;
  return hadAny ? stats : null;
}
