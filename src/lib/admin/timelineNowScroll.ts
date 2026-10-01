/** Duration of the showcase timeline's eased scroll to the "now" row. */
export const TIMELINE_NOW_SCROLL_DURATION_MS = 600;

/** Where the "now" row lands in the visible timeline: 0 = top, 0.5 = centre. */
export const TIMELINE_NOW_ANCHOR = 0.42;

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** `scrollTop` that puts the middle of `row` at `anchor` of the container's visible height. */
export function timelineNowScrollTarget(
  container: HTMLElement,
  row: HTMLElement,
  anchor: number = TIMELINE_NOW_ANCHOR,
): number {
  const containerRect = container.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const rowOffset = container.scrollTop + (rowRect.top - containerRect.top);
  const raw = rowOffset + rowRect.height / 2 - container.clientHeight * anchor;
  const max = Math.max(0, container.scrollHeight - container.clientHeight);
  return Math.round(Math.min(max, Math.max(0, raw)));
}

/**
 * Scrolls only `container` (never the page or another ancestor) so `row` sits at the anchor.
 * Eased over `TIMELINE_NOW_SCROLL_DURATION_MS`, or a direct jump for reduced motion. Any
 * pointer, touch or wheel input on the container stops the animation where it is.
 * Returns a cancel function.
 */
export function scrollContainerToRow(
  container: HTMLElement,
  row: HTMLElement,
  reduceMotion: boolean,
  win: Window = window,
): () => void {
  const start = container.scrollTop;
  const target = timelineNowScrollTarget(container, row);
  const distance = target - start;
  const previousBehavior = container.style.scrollBehavior;
  container.style.scrollBehavior = 'auto';

  if (reduceMotion || Math.abs(distance) < 1) {
    container.scrollTop = target;
    container.style.scrollBehavior = previousBehavior;
    return () => {};
  }

  let frameId: number | null = null;
  let startTime: number | null = null;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    if (frameId !== null) win.cancelAnimationFrame(frameId);
    frameId = null;
    container.style.scrollBehavior = previousBehavior;
    container.removeEventListener('pointerdown', finish);
    container.removeEventListener('touchstart', finish);
    container.removeEventListener('wheel', finish);
  };

  const step = (now: number) => {
    if (finished) return;
    if (startTime === null) startTime = now;
    const progress = Math.min(1, (now - startTime) / TIMELINE_NOW_SCROLL_DURATION_MS);
    container.scrollTop = start + distance * easeInOutCubic(progress);
    if (progress < 1) {
      frameId = win.requestAnimationFrame(step);
    } else {
      finish();
    }
  };

  container.addEventListener('pointerdown', finish, { passive: true });
  container.addEventListener('touchstart', finish, { passive: true });
  container.addEventListener('wheel', finish, { passive: true });
  frameId = win.requestAnimationFrame(step);
  return finish;
}
