export const TAP_HAND_SRC = '/images/Ilustracje/raczka.png';
export const TAP_HAND_SCROLL_END_FALLBACK_MS = 700;
export const TAP_HAND_AUTO_DISMISS_MS = 8000;
export const BLACKLINE_TAP_HINT_SEEN_KEY = 'kersivo.blackline.tap-hint.seen.v1';

export type TapHandPosition = { top: number; left: number };

export function positionTapHand(root: HTMLElement, target: HTMLElement): TapHandPosition {
  const rootRect = root.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  return {
    top: targetRect.top - rootRect.top + targetRect.height / 2,
    left: targetRect.left - rootRect.left + targetRect.width * 0.5,
  };
}

export function waitForScrollSettled(
  container: HTMLElement,
  onSettled: () => void,
  options: { reducedMotion?: boolean; fallbackMs?: number } = {},
): () => void {
  const fallbackMs = options.fallbackMs ?? TAP_HAND_SCROLL_END_FALLBACK_MS;
  if (options.reducedMotion) {
    const frame = window.requestAnimationFrame(() => onSettled());
    return () => window.cancelAnimationFrame(frame);
  }

  let timeoutId: number | undefined;
  const onScrollEnd = () => {
    container.removeEventListener('scrollend', onScrollEnd);
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    onSettled();
  };
  container.addEventListener('scrollend', onScrollEnd, { once: true });
  timeoutId = window.setTimeout(() => {
    container.removeEventListener('scrollend', onScrollEnd);
    onSettled();
  }, fallbackMs);

  return () => {
    container.removeEventListener('scrollend', onScrollEnd);
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  };
}

function readSeenIds(): string[] {
  try {
    if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) return [];
    const raw = globalThis.sessionStorage.getItem(BLACKLINE_TAP_HINT_SEEN_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function hasSeenBlacklineTapHint(bookingId: string): boolean {
  return readSeenIds().includes(bookingId);
}

export function markBlacklineTapHintSeen(bookingId: string): void {
  try {
    if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) return;
    const next = Array.from(new Set([...readSeenIds(), bookingId]));
    globalThis.sessionStorage.setItem(BLACKLINE_TAP_HINT_SEEN_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
