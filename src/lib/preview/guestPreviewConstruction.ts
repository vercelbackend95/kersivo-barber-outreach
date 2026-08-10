/** Stored on ShopSettings.publicActivityPauseReason for guest provisional shops. */
export const GUEST_PREVIEW_PAUSE_REASON =
  'Shop under construction — goes live after subscription.';

/** Older reason string still present on shops created before the copy change. */
export const GUEST_PREVIEW_PAUSE_REASON_LEGACY =
  'Guest preview — not public until subscribed.';

export const PREVIEW_PAUSE_LOCKED_MESSAGE =
  'Public booking stays off for this preview shop. Subscribe to launch and go live.';

export function isGuestPreviewConstructionPause(reason: string | null | undefined): boolean {
  const trimmed = reason?.trim() || '';
  return trimmed === GUEST_PREVIEW_PAUSE_REASON || trimmed === GUEST_PREVIEW_PAUSE_REASON_LEGACY;
}

/** Preview cookie or construction pause reason — owner cannot resume public activity. */
export function isPreviewPublicActivityLocked(input: {
  via?: string | null;
  pauseReason?: string | null;
}): boolean {
  return input.via === 'preview' || isGuestPreviewConstructionPause(input.pauseReason);
}
