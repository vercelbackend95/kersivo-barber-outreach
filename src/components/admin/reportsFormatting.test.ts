import { describe, expect, it } from 'vitest';

import { formatDelta } from './reportsFormatting';

describe('formatDelta', () => {
  it('never includes a minus character in simple percent/pp trend text', () => {
    const up = formatDelta({ value: 12.5, type: 'percent', tone: 'higher_better' });
    const downRevenue = formatDelta({ value: -13.6, type: 'percent', tone: 'higher_better' });
    const cancelImproved = formatDelta({ value: -1.2, type: 'pp', tone: 'lower_better' });

    expect(up.text).toBe('+12.5%');
    expect(downRevenue.text).toBe('13.6%');
    expect(cancelImproved.text).toBe('1.2pp');
    expect(up.text).not.toContain('-');
    expect(downRevenue.text).not.toContain('-');
    expect(cancelImproved.text).not.toContain('-');
  });

  it('uses Coinbase absolute + 100% when previous baseline is zero', () => {
    expect(formatDelta({
      value: null,
      type: 'percent',
      valueType: 'currency',
      currentValue: 203,
      previousValue: 0,
    }).text).toBe('+£203 (100%)');

    expect(formatDelta({
      value: null,
      type: 'percent',
      valueType: 'count',
      currentValue: 8,
      previousValue: 0,
    }).text).toBe('+8 (100%)');

    expect(formatDelta({
      value: null,
      type: 'pp',
      valueType: 'pp',
      currentValue: 4.3,
      previousValue: 0,
    }).text).toBe('+4.3pp (100%)');
  });

  it('shows dash when both current and previous are zero', () => {
    const delta = formatDelta({
      value: null,
      type: 'percent',
      valueType: 'count',
      currentValue: 0,
      previousValue: 0,
    });
    expect(delta.text).toBe('—');
    expect(delta.direction).toBe('flat');
  });

  it('shows absolute change with true percent when previous is non-zero', () => {
    const up = formatDelta({
      value: 50,
      type: 'percent',
      valueType: 'currency',
      currentValue: 150,
      previousValue: 100,
    });
    const down = formatDelta({
      value: -25,
      type: 'percent',
      valueType: 'count',
      currentValue: 75,
      previousValue: 100,
    });
    expect(up.text).toBe('+£50.00 (+50.0%)');
    expect(down.text).toBe('-25 (-25.0%)');
    expect(up.direction).toBe('up');
    expect(down.direction).toBe('down');
  });

  it('falls back to +100% without valueType on zero baseline', () => {
    expect(formatDelta({
      value: null,
      type: 'percent',
      currentValue: 203,
      previousValue: 0,
    }).text).toBe('+100%');
  });
});
