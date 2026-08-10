export const PREVIEW_SUBSCRIBE_BANNER_STORAGE_KEY = 'kersivo:preview-subscribe-banner';

/** Hide for this many admin section navigations after dismiss, then show again. */
export const PREVIEW_SUBSCRIBE_BANNER_SECTION_HIDES = 4;

type PreviewSubscribeBannerState = {
  remainingSectionHides: number;
};

function readState(): PreviewSubscribeBannerState | null {
  if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) return null;
  try {
    const raw = globalThis.sessionStorage.getItem(PREVIEW_SUBSCRIBE_BANNER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PreviewSubscribeBannerState>;
    const remaining = Number(parsed.remainingSectionHides);
    if (!Number.isFinite(remaining) || remaining <= 0) return null;
    return { remainingSectionHides: Math.floor(remaining) };
  } catch {
    return null;
  }
}

function writeState(state: PreviewSubscribeBannerState | null) {
  if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) return;
  try {
    if (!state || state.remainingSectionHides <= 0) {
      globalThis.sessionStorage.removeItem(PREVIEW_SUBSCRIBE_BANNER_STORAGE_KEY);
      return;
    }
    globalThis.sessionStorage.setItem(PREVIEW_SUBSCRIBE_BANNER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private-mode failures — banner simply stays visible.
  }
}

/** True when the preview subscribe banner should render. */
export function isPreviewSubscribeBannerVisible(): boolean {
  return readState() === null;
}

export function dismissPreviewSubscribeBanner(
  hides: number = PREVIEW_SUBSCRIBE_BANNER_SECTION_HIDES,
): void {
  writeState({ remainingSectionHides: Math.max(1, Math.floor(hides)) });
}

/**
 * Call on admin section change while the banner is eligible (preview mode).
 * Returns whether the banner should be visible after this navigation.
 */
export function notePreviewSubscribeBannerSectionChange(): boolean {
  const state = readState();
  if (!state) return true;
  const next = state.remainingSectionHides - 1;
  if (next <= 0) {
    writeState(null);
    return true;
  }
  writeState({ remainingSectionHides: next });
  return false;
}
