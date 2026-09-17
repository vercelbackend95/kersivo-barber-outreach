import { describe, expect, it } from 'vitest';
import { LANDING_PREVIEW_PASSIVE_MQ } from './useMaxWidthPassive';

describe('LANDING_PREVIEW_PASSIVE_MQ', () => {
  it('targets stacked feature261 breakpoint', () => {
    expect(LANDING_PREVIEW_PASSIVE_MQ).toBe('(max-width: 899px)');
  });
});
