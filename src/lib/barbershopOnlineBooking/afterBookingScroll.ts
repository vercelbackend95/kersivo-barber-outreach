/**
 * Progressive enhancement for Section 06 cinematic scroll story.
 *
 * Maps sticky-track scroll position to --bob-ab-p (0→1). No wheel interception.
 * No-ops when prefers-reduced-motion: reduce (CSS stacks scenes in document flow).
 */

const ROOT_SEL = '.bob-ab[data-bob-ab]';
const TRACK_SEL = '[data-bob-ab-track]';
const PROGRESS_VAR = '--bob-ab-p';

function prefersReducedMotion(win: Window & typeof globalThis): boolean {
  return win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Progress 0→1 from track top entering viewport to track bottom leaving. */
export function computeStoryProgress(
  trackTop: number,
  trackHeight: number,
  viewportHeight: number,
): number {
  if (trackHeight <= viewportHeight || viewportHeight <= 0) return 0;
  const scrollable = trackHeight - viewportHeight;
  const traveled = -trackTop;
  if (traveled <= 0) return 0;
  if (traveled >= scrollable) return 1;
  return traveled / scrollable;
}

/**
 * Binds every Section 06 story on the page. Safe to call repeatedly; each root is
 * bound once and unbound before a soft swap.
 */
export function bindAfterBookingScroll(win: Window & typeof globalThis = window): void {
  const doc = win.document;

  for (const root of doc.querySelectorAll<HTMLElement>(ROOT_SEL)) {
    if (root.dataset.bobAbBound === 'true') continue;

    const track = root.querySelector<HTMLElement>(TRACK_SEL);
    if (!track) continue;

    root.dataset.bobAbBound = 'true';

    let raf = 0;

    const apply = () => {
      raf = 0;
      if (prefersReducedMotion(win)) {
        root.style.setProperty(PROGRESS_VAR, '0');
        root.dataset.bobAbScrub = 'off';
        return;
      }
      root.dataset.bobAbScrub = 'on';
      const rect = track.getBoundingClientRect();
      const p = computeStoryProgress(rect.top, rect.height, win.innerHeight);
      root.style.setProperty(PROGRESS_VAR, p.toFixed(4));
    };

    const schedule = () => {
      if (raf) return;
      raf = win.requestAnimationFrame(apply);
    };

    apply();

    win.addEventListener('scroll', schedule, { passive: true });
    win.addEventListener('resize', schedule);

    const mq = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => schedule();
    mq?.addEventListener?.('change', onMotionChange);

    doc.addEventListener(
      'astro:before-swap',
      () => {
        win.removeEventListener('scroll', schedule);
        win.removeEventListener('resize', schedule);
        mq?.removeEventListener?.('change', onMotionChange);
        if (raf) win.cancelAnimationFrame(raf);
        delete root.dataset.bobAbBound;
        delete root.dataset.bobAbScrub;
        root.style.removeProperty(PROGRESS_VAR);
      },
      { once: true },
    );
  }
}
