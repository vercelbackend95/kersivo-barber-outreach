import { describe, expect, it } from 'vitest';
import type { HubCriterionId } from '@/lib/compare/alternativesHubCriteria';
import { HUB_SUGGESTED_CRITERIA } from '@/lib/compare/alternativesHubCriteria';
import { buildHubScoreInputs } from '@/lib/compare/alternativesHubData';
import {
  HUB_RING_CIRCUMFERENCE,
  describeScore,
  formatScoreLabel,
  rankPlatforms,
  ringDashOffset,
  scorePlatform,
  type HubScoreInput,
} from '@/lib/compare/alternativesHubScoring';

const fixture: HubScoreInput[] = [
  { id: 'us', name: 'Us', isFirstParty: true, order: 0, statuses: { zeroCommission: 'no', deposits: 'no' } },
  { id: 'alpha', name: 'Zulu', isFirstParty: false, order: 1, statuses: { zeroCommission: 'yes', deposits: 'no' } },
  { id: 'bravo', name: 'Bravo', isFirstParty: false, order: 2, statuses: { zeroCommission: 'yes', deposits: 'yes' } },
  { id: 'charlie', name: 'Alpha', isFirstParty: false, order: 3, statuses: { zeroCommission: 'limited', deposits: 'unverified' } },
  { id: 'delta', name: 'Delta', isFirstParty: false, order: 4, statuses: { zeroCommission: 'unverified', deposits: 'unverified' } },
  { id: 'echo', name: 'Echo', isFirstParty: false, order: 5, statuses: { zeroCommission: 'no', deposits: 'no' } },
];

const both: HubCriterionId[] = ['zeroCommission', 'deposits'];

describe('scorePlatform', () => {
  it('counts only verified yes values as matches', () => {
    expect(scorePlatform(fixture[2], both)).toMatchObject({ matches: 2, partial: 0, unverified: 0, misses: 0, ratio: 1 });
    expect(scorePlatform(fixture[1], both)).toMatchObject({ matches: 1, misses: 1, ratio: 0.5 });
  });

  it('reports limited as partial and unknown as unverified, never as matches or misses', () => {
    const score = scorePlatform(fixture[3], both);
    expect(score).toMatchObject({ matches: 0, partial: 1, unverified: 1, misses: 0 });
  });

  it('treats a missing status as unverified rather than a failure', () => {
    const score = scorePlatform({ ...fixture[1], statuses: {} }, both);
    expect(score).toMatchObject({ matches: 0, unverified: 2, misses: 0 });
  });

  it('returns a neutral score when nothing is selected', () => {
    const score = scorePlatform(fixture[2], []);
    expect(score.selected).toBe(0);
    expect(score.ratio).toBe(0);
    expect(formatScoreLabel(score)).toBe('–');
    expect(describeScore(score)).toBe('No priorities selected');
  });

  it('formats the score against the actual number of selected criteria', () => {
    expect(formatScoreLabel(scorePlatform(fixture[1], both))).toBe('1/2');
    expect(formatScoreLabel(scorePlatform(fixture[1], ['zeroCommission']))).toBe('1/1');
    expect(describeScore(scorePlatform(fixture[3], both))).toBe('0 of 2 selected priorities matched, 1 partial, 1 not verified');
  });
});

describe('rankPlatforms', () => {
  it('keeps the first-party platform first even when it scores lowest', () => {
    const ranked = rankPlatforms(fixture, both);
    expect(ranked[0].platform.id).toBe('us');
  });

  it('sorts by matches, then partial, then unverified (unknown above confirmed no), then registry order', () => {
    expect(rankPlatforms(fixture, both).map((r) => r.platform.id)).toEqual(['us', 'bravo', 'alpha', 'charlie', 'delta', 'echo']);
  });

  it('is deterministic for ties using registry order', () => {
    const tied = rankPlatforms(fixture, ['deposits']).map((r) => r.platform.id);
    expect(tied).toEqual(['us', 'bravo', 'charlie', 'delta', 'alpha', 'echo']);
    expect(rankPlatforms(fixture, ['deposits']).map((r) => r.platform.id)).toEqual(tied);
  });

  it('uses registry order when nothing is selected', () => {
    expect(rankPlatforms(fixture, []).map((r) => r.platform.id)).toEqual(['us', 'alpha', 'bravo', 'charlie', 'delta', 'echo']);
  });

  it('supports alphabetical sorting while keeping the first-party platform first', () => {
    expect(rankPlatforms(fixture, both, 'name').map((r) => r.platform.name)).toEqual(['Us', 'Alpha', 'Bravo', 'Delta', 'Echo', 'Zulu']);
  });

  it('keeps every platform visible (no filtering out)', () => {
    expect(rankPlatforms(fixture, both)).toHaveLength(fixture.length);
  });
});

describe('ring geometry', () => {
  it('maps ratios to dash offsets and clamps out-of-range values', () => {
    expect(ringDashOffset(1)).toBe(0);
    expect(ringDashOffset(0)).toBeCloseTo(HUB_RING_CIRCUMFERENCE, 2);
    expect(ringDashOffset(2)).toBe(0);
    expect(ringDashOffset(-1)).toBeCloseTo(HUB_RING_CIRCUMFERENCE, 2);
  });
});

describe('real hub data', () => {
  it('keeps KERSIVO first under the suggested priorities and every single criterion', () => {
    const inputs = buildHubScoreInputs();
    expect(rankPlatforms(inputs, HUB_SUGGESTED_CRITERIA)[0].platform.id).toBe('kersivo');
    for (const criterion of HUB_SUGGESTED_CRITERIA) {
      expect(rankPlatforms(inputs, [criterion], 'best')[0].platform.id).toBe('kersivo');
      expect(rankPlatforms(inputs, [criterion], 'name')[0].platform.id).toBe('kersivo');
    }
  });
});
