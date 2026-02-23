import { describe, expect, it } from 'vitest';
import { hasOverlap } from './overlap';

describe('overlap', () => {
  it('detects overlap', () => {
    expect(hasOverlap(
      { startAt: new Date('2025-01-01T10:00:00Z'), endAt: new Date('2025-01-01T10:30:00Z') },
      { startAt: new Date('2025-01-01T10:15:00Z'), endAt: new Date('2025-01-01T11:00:00Z') }
    )).toBe(true);
  });

  it('returns false for touching edges', () => {
    expect(hasOverlap(
      { startAt: new Date('2025-01-01T10:00:00Z'), endAt: new Date('2025-01-01T10:30:00Z') },
      { startAt: new Date('2025-01-01T10:30:00Z'), endAt: new Date('2025-01-01T11:00:00Z') }
    )).toBe(false);
  });
});
