import { describe, expect, it } from 'vitest';
import {
  LANDING_TIMELINE_SCROLL_FOCUS,
  pickClosestTimeLabel,
} from './liveTimelineScroll';

describe('pickClosestTimeLabel', () => {
  it('returns exact match when present', () => {
    expect(
      pickClosestTimeLabel(['13:00', '14:10', '15:00'], LANDING_TIMELINE_SCROLL_FOCUS),
    ).toBe('14:10');
  });

  it('picks nearest slot when focus is missing (30-min grid)', () => {
    expect(pickClosestTimeLabel(['13:30', '14:00', '14:30'], '14:10')).toBe('14:00');
  });

  it('prefers 14:15 over 14:00 when closer to 14:10', () => {
    expect(pickClosestTimeLabel(['14:00', '14:15'], '14:10')).toBe('14:15');
  });

  it('returns null for empty or invalid input', () => {
    expect(pickClosestTimeLabel([], '14:10')).toBeNull();
    expect(pickClosestTimeLabel(['nope'], '14:10')).toBeNull();
    expect(pickClosestTimeLabel(['14:00'], 'bad')).toBeNull();
  });
});
