import { describe, expect, it } from 'vitest';
import {
  buildLinearPath,
  buildSmoothPath,
  niceTicks,
  snapIndex,
  sortChartLabels,
} from './chartUtils';

describe('niceTicks', () => {
  it('returns readable round ticks for currency-like ranges', () => {
    const { min, max, ticks } = niceTicks(0, 28400, 3);
    expect(min).toBeLessThanOrEqual(0);
    expect(max).toBeGreaterThanOrEqual(28400);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]).toBe(min);
    expect(ticks[ticks.length - 1]).toBe(max);
  });

  it('handles equal min and max', () => {
    const { ticks } = niceTicks(100, 100, 3);
    expect(ticks.length).toBeGreaterThan(1);
  });
});

describe('snapIndex', () => {
  it('snaps to nearest label index', () => {
    expect(snapIndex(52, 50, 800, 5)).toBe(0);
    expect(snapIndex(450, 50, 800, 5)).toBe(2);
    expect(snapIndex(850, 50, 800, 5)).toBe(4);
  });

  it('returns 0 for single label', () => {
    expect(snapIndex(200, 50, 800, 1)).toBe(0);
  });
});

describe('buildSmoothPath', () => {
  it('returns empty string for no points', () => {
    expect(buildSmoothPath([])).toBe('');
  });

  it('returns move command for single point', () => {
    expect(buildSmoothPath([{ x: 10, y: 20 }])).toBe('M 10 20');
  });

  it('builds cubic segments for multiple points', () => {
    const path = buildSmoothPath([
      { x: 0, y: 100 },
      { x: 50, y: 50 },
      { x: 100, y: 80 },
    ]);
    expect(path.startsWith('M 0 100')).toBe(true);
    expect(path).toContain('C');
  });
});

describe('buildLinearPath', () => {
  it('joins points with line commands', () => {
    const path = buildLinearPath([
      { x: 0, y: 10 },
      { x: 20, y: 30 },
    ]);
    expect(path).toBe('M 0 10 L 20 30');
  });
});

describe('sortChartLabels', () => {
  it('sorts ISO dates chronologically', () => {
    expect(sortChartLabels(['2026-07-09', '2026-07-07', '2026-07-08'])).toEqual([
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
    ]);
  });

  it('sorts weekday abbreviations Mon through Sun', () => {
    expect(sortChartLabels(['Fri', 'Wed', 'Mon', 'Thu'])).toEqual(['Mon', 'Wed', 'Thu', 'Fri']);
  });

  it('preserves first-seen order for unknown label formats', () => {
    expect(sortChartLabels(['Q3', 'Q1', 'Q2', 'Q1'])).toEqual(['Q3', 'Q1', 'Q2']);
  });
});
