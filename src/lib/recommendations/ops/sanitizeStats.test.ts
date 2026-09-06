import { describe, expect, it } from 'vitest';

import { sanitizeRecommendationSetStats } from './sanitizeStats';

describe('sanitizeRecommendationSetStats', () => {
  it('returns null for non-objects', () => {
    expect(sanitizeRecommendationSetStats(null)).toBeNull();
    expect(sanitizeRecommendationSetStats('x')).toBeNull();
    expect(sanitizeRecommendationSetStats([])).toBeNull();
  });

  it('whitelists and coerces numbers; drops unknown keys', () => {
    const stats = sanitizeRecommendationSetStats({
      serviceCount: 3,
      productCount: '4',
      itemCount: -1,
      rerankEligibleServiceCount: 1,
      rerankAttemptedServiceCount: 1,
      rerankAppliedServiceCount: 0,
      rerankFallbackServiceCount: 0,
      rerankSkippedInsufficientCandidatesCount: 0,
      rerankFallbackReasonCounts: { TIMEOUT: 2, EVIL: 'nope' },
      secretToken: 'sk-abc',
      rawError: { message: 'boom' },
    });
    expect(stats).toEqual({
      serviceCount: 3,
      productCount: 4,
      itemCount: 0,
      rerankEligibleServiceCount: 1,
      rerankAttemptedServiceCount: 1,
      rerankAppliedServiceCount: 0,
      rerankFallbackServiceCount: 0,
      rerankSkippedInsufficientCandidatesCount: 0,
      rerankFallbackReasonCounts: { TIMEOUT: 2, EVIL: 0 },
    });
    expect(JSON.stringify(stats)).not.toContain('sk-abc');
    expect(JSON.stringify(stats)).not.toContain('secretToken');
  });

  it('keeps only stable UPPER_SNAKE reason keys and caps at 32', () => {
    const rawReasons: Record<string, number> = {
      TIMEOUT: 1,
      MODEL_ERROR: 2,
      'lowercase': 9,
      'Has-Dash': 9,
      '<script>alert(1)</script>': 9,
      'A\nB': 9,
      'sk-live-secretish': 9,
      'path/to/file': 9,
      '': 9,
    };
    for (let i = 0; i < 40; i += 1) {
      rawReasons[`CODE_${String(i).padStart(2, '0')}`] = i + 1;
    }

    const stats = sanitizeRecommendationSetStats({
      serviceCount: 1,
      rerankFallbackReasonCounts: rawReasons,
    });
    expect(stats).not.toBeNull();
    const keys = Object.keys(stats!.rerankFallbackReasonCounts);
    expect(keys).toHaveLength(32);
    expect(keys.every((k) => /^[A-Z][A-Z0-9_]{0,63}$/.test(k))).toBe(true);
    expect(keys).toContain('TIMEOUT');
    expect(keys).toContain('MODEL_ERROR');
    expect(JSON.stringify(stats)).not.toContain('<script>');
    expect(JSON.stringify(stats)).not.toContain('sk-live');
    expect(JSON.stringify(stats)).not.toContain('\\n');
    expect(stats!.rerankFallbackReasonCounts.TIMEOUT).toBe(1);
    expect(stats!.rerankFallbackReasonCounts.MODEL_ERROR).toBe(2);
  });
});
