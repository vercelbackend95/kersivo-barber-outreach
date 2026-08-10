import { describe, expect, it } from 'vitest';
import {
  GUEST_PREVIEW_PAUSE_REASON,
  GUEST_PREVIEW_PAUSE_REASON_LEGACY,
  isGuestPreviewConstructionPause,
  isPreviewPublicActivityLocked,
} from './guestPreviewConstruction';

describe('isGuestPreviewConstructionPause', () => {
  it('recognizes construction pause reasons including legacy', () => {
    expect(isGuestPreviewConstructionPause(GUEST_PREVIEW_PAUSE_REASON)).toBe(true);
    expect(isGuestPreviewConstructionPause(` ${GUEST_PREVIEW_PAUSE_REASON} `)).toBe(true);
    expect(isGuestPreviewConstructionPause(GUEST_PREVIEW_PAUSE_REASON_LEGACY)).toBe(true);
    expect(isGuestPreviewConstructionPause('Owner paused for holiday')).toBe(false);
    expect(isGuestPreviewConstructionPause(null)).toBe(false);
    expect(isGuestPreviewConstructionPause(undefined)).toBe(false);
  });
});

describe('isPreviewPublicActivityLocked', () => {
  it('locks preview via and construction reasons', () => {
    expect(isPreviewPublicActivityLocked({ via: 'preview', pauseReason: null })).toBe(true);
    expect(
      isPreviewPublicActivityLocked({ via: 'session', pauseReason: GUEST_PREVIEW_PAUSE_REASON }),
    ).toBe(true);
    expect(isPreviewPublicActivityLocked({ via: 'session', pauseReason: 'Holiday' })).toBe(false);
  });
});
