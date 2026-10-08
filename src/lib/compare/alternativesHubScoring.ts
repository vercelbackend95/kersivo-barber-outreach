/**
 * Pure, deterministic match scoring for the /compare Alternatives Hub.
 * Shared by server rendering and the client script so both agree exactly.
 *
 * - Only 'yes' counts as a match. 'limited' is reported as partial, never as a match.
 * - 'unverified' is reported separately and ranks above a confirmed 'no'.
 * - The first-party platform (KERSIVO) is pinned first and never sorted.
 */
import type { HubCriterionId } from '@/lib/compare/alternativesHubCriteria';
import type { HubStatus } from '@/lib/compare/alternativesHubData';

export type HubStatusMap = Record<string, HubStatus>;

export type HubScoreInput = {
  id: string;
  name: string;
  isFirstParty: boolean;
  /** Registry position used as the final tie-breaker. */
  order: number;
  statuses: HubStatusMap;
};

export type HubScore = {
  id: string;
  selected: number;
  matches: number;
  partial: number;
  unverified: number;
  misses: number;
  /** 0–1 share of selected criteria fully matched; 0 when nothing is selected. */
  ratio: number;
};

export type HubSortMode = 'best' | 'name';

export const HUB_SORT_MODES: readonly { value: HubSortMode; label: string }[] = [
  { value: 'best', label: 'Best match' },
  { value: 'name', label: 'Name (A–Z)' },
];

export function scorePlatform(platform: HubScoreInput, selected: readonly HubCriterionId[]): HubScore {
  let matches = 0;
  let partial = 0;
  let unverified = 0;
  let misses = 0;
  for (const criterion of selected) {
    const status = platform.statuses[criterion] ?? 'unverified';
    if (status === 'yes') matches += 1;
    else if (status === 'limited') partial += 1;
    else if (status === 'unverified') unverified += 1;
    else misses += 1;
  }
  return {
    id: platform.id,
    selected: selected.length,
    matches,
    partial,
    unverified,
    misses,
    ratio: selected.length === 0 ? 0 : matches / selected.length,
  };
}

function compareBestMatch(a: HubScoreInput, b: HubScoreInput, sa: HubScore, sb: HubScore): number {
  return (
    sb.matches - sa.matches ||
    sb.partial - sa.partial ||
    sb.unverified - sa.unverified ||
    a.order - b.order
  );
}

/**
 * Returns platforms in display order: first-party platforms first (registry order),
 * then competitors sorted by the requested mode. With no criteria selected,
 * 'best' falls back to registry order.
 */
export function rankPlatforms<T extends HubScoreInput>(
  platforms: readonly T[],
  selected: readonly HubCriterionId[],
  mode: HubSortMode = 'best',
): { platform: T; score: HubScore }[] {
  const scored = platforms.map((platform) => ({ platform, score: scorePlatform(platform, selected) }));
  const pinned = scored.filter((s) => s.platform.isFirstParty).sort((a, b) => a.platform.order - b.platform.order);
  const rest = scored.filter((s) => !s.platform.isFirstParty);

  rest.sort((a, b) => {
    if (mode === 'name') {
      return a.platform.name.localeCompare(b.platform.name, 'en-GB') || a.platform.order - b.platform.order;
    }
    if (selected.length === 0) return a.platform.order - b.platform.order;
    return compareBestMatch(a.platform, b.platform, a.score, b.score);
  });

  return [...pinned, ...rest];
}

/** Text for the score ring label, e.g. "5/7". Empty selection gives a neutral dash. */
export function formatScoreLabel(score: HubScore): string {
  return score.selected === 0 ? '–' : `${score.matches}/${score.selected}`;
}

/** Accessible description of a score. */
export function describeScore(score: HubScore): string {
  if (score.selected === 0) return 'No priorities selected';
  const parts = [`${score.matches} of ${score.selected} selected priorities matched`];
  if (score.partial) parts.push(`${score.partial} partial`);
  if (score.unverified) parts.push(`${score.unverified} not verified`);
  return parts.join(', ');
}

/** SVG ring geometry shared by server markup and client updates. */
export const HUB_RING_RADIUS = 26;
export const HUB_RING_CIRCUMFERENCE = 2 * Math.PI * HUB_RING_RADIUS;

export function ringDashOffset(ratio: number): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  return Number((HUB_RING_CIRCUMFERENCE * (1 - clamped)).toFixed(3));
}
