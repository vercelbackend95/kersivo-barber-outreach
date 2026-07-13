import { describe, expect, it } from 'vitest';

import { formatDelta } from './reportsFormatting';

describe('formatDelta', () => {
  it('never includes a minus character in trend text', () => {
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
});
