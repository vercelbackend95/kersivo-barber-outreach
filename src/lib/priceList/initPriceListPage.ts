/**
 * Client choreography for /barbershop-price-list-template.
 *
 * - Hero: the title lines rise once on load, the copy and form follow, the board lifts in and the
 *   sheet's dotted leaders draw left to right. One entrance, then nothing moves on its own.
 * - The tool itself (initPriceListTool): add, remove, reorder (Flip), styles, export.
 * - Moment: the annotated sheet. On wide screens the sheet stays in view (CSS sticky) while the notes scroll
 *   past, and a ring glides to the part each note describes. The notes are buttons everywhere, so
 *   touch, keyboard and reduced motion get the same ring without any scroll link.
 * - Phones and tablets: a small dock with progress and a jump to the preview while the form is
 *   on screen and the preview is not.
 *
 * Under prefers-reduced-motion nothing is hidden or tweened. Returns a cleanup for ClientRouter.
 */
import { gsap } from 'gsap';
import { initPriceListTool } from './initPriceListTool';

type Cleanup = () => void;

const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Hero entrance ---------- */

function initHero(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const hero = root.querySelector<HTMLElement>('[data-pl-hero]');
  if (!hero) return;
  if (reduced) {
    hero.classList.add('is-in');
    return;
  }
  const rise = hero.querySelectorAll('[data-pl-rise]');
  const enter = hero.querySelectorAll('[data-pl-enter]');
  const board = hero.querySelector('[data-pl-board]');
  const leaders = hero.querySelectorAll('.pl-sheet .pl-sheet__leader');
  const items = hero.querySelectorAll('.pl-sheet .pl-sheet__item');

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  // y: 0 clears the CSS pre-hide offset, which GSAP would otherwise cache as pixels.
  tl.fromTo(rise, { y: 0, yPercent: 108 }, { y: 0, yPercent: 0, duration: 1.05, stagger: 0.1 }, 0.05)
    .fromTo(enter, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out' }, 0.3)
    .fromTo(board, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 0.2)
    .fromTo(items, { autoAlpha: 0, x: -6 }, { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.045, ease: 'power2.out' }, 0.55)
    .fromTo(leaders, { scaleX: 0 }, { scaleX: 1, duration: 0.7, stagger: 0.045, ease: 'power2.inOut', transformOrigin: 'left center', clearProps: 'transform' }, 0.62);
  hero.classList.add('is-in');
  disposers.push(() => tl.kill());
}

/* ---------- Moment: the annotated sheet ---------- */

function initAnatomy(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-pl-anatomy]');
  const sheet = section?.querySelector<HTMLElement>('[data-pl-anatomy-sheet]');
  const ring = section?.querySelector<HTMLElement>('[data-pl-anatomy-ring]');
  if (!section || !sheet || !ring) return;
  const items = Array.from(section.querySelectorAll<HTMLElement>('[data-pl-part]'));
  let active = items[0]?.dataset.plPart ?? 'title';

  const rectFor = (part: string) => {
    const targets = Array.from(sheet.querySelectorAll<HTMLElement>(`[data-part="${part}"]`));
    if (!targets.length) return null;
    const base = sheet.getBoundingClientRect();
    const rects = targets.map((el) => el.getBoundingClientRect());
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const padX = 10;
    const padY = 7;
    return {
      x: left - base.left - padX,
      y: top - base.top - padY,
      width: right - left + padX * 2,
      height: bottom - top + padY * 2,
    };
  };

  const place = (animate: boolean) => {
    const rect = rectFor(active);
    if (!rect) return;
    if (animate && !reduced) gsap.to(ring, { ...rect, autoAlpha: 1, duration: 0.55, ease: 'power3.inOut', overwrite: true });
    else gsap.set(ring, { ...rect, autoAlpha: 1 });
    sheet.querySelectorAll('[data-part]').forEach((el) => {
      el.classList.toggle('is-lit', (el as HTMLElement).dataset.part === active);
    });
  };

  const activate = (part: string, animate = true) => {
    if (part === active && ring.style.opacity) return;
    active = part;
    items.forEach((item) => {
      const on = item.dataset.plPart === part;
      item.dataset.active = String(on);
      item.querySelector('button')?.setAttribute('aria-pressed', String(on));
    });
    place(animate);
  };

  const onClick = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pl-part-btn]');
    if (button?.dataset.plPartBtn) activate(button.dataset.plPartBtn);
  };
  section.addEventListener('click', onClick);
  disposers.push(() => section.removeEventListener('click', onClick));

  const onResize = () => place(false);
  window.addEventListener('resize', onResize);
  disposers.push(() => window.removeEventListener('resize', onResize));

  // Fonts change the sheet's metrics: place the ring again once they are in.
  void document.fonts.ready.then(() => place(false));
  place(false);

  // Scroll link only where the sheet stays in view beside the notes, and only with motion.
  if (reduced) return;
  // A thin band just below the middle of the screen: the note crossing it is the active one.
  // IntersectionObserver reads live layout, so late font or image shifts cannot leave it stale.
  if (!('IntersectionObserver' in window)) return;
  const wide = window.matchMedia('(min-width: 1024px)');
  let observer: IntersectionObserver | null = null;
  const connect = () => {
    observer?.disconnect();
    observer = null;
    if (!wide.matches) return;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const part = (entry.target as HTMLElement).dataset.plPart;
          if (entry.isIntersecting && part) activate(part);
        }
      },
      { rootMargin: '-52% 0px -47% 0px' },
    );
    items.forEach((item) => observer?.observe(item));
  };
  connect();
  wide.addEventListener('change', connect);
  disposers.push(() => {
    observer?.disconnect();
    wide.removeEventListener('change', connect);
  });
}

/* ---------- Dock (phones and tablets) ---------- */

function initDock(root: HTMLElement, disposers: Cleanup[]) {
  const dock = root.querySelector<HTMLElement>('[data-pl-dock]');
  // The services step, not the whole form: the dock stays out of the way on the first screen.
  const form = root.querySelector<HTMLElement>('#step-services');
  const board = root.querySelector<HTMLElement>('[data-pl-board]');
  if (!dock || !form || !board || !('IntersectionObserver' in window)) return;

  let formVisible = false;
  let boardVisible = false;
  const sync = () => {
    const show = formVisible && !boardVisible;
    dock.dataset.visible = String(show);
    dock.toggleAttribute('inert', !show);
    dock.setAttribute('aria-hidden', String(!show));
  };
  sync();
  // The services step counts only once it reaches the upper 55% of the screen.
  const formObserver = new IntersectionObserver((entries) => {
    formVisible = entries[entries.length - 1].isIntersecting;
    sync();
  }, { rootMargin: '0px 0px -45% 0px' });
  const boardObserver = new IntersectionObserver((entries) => {
    boardVisible = entries[entries.length - 1].intersectionRatio > 0.15;
    sync();
  }, { threshold: [0, 0.15] });
  formObserver.observe(form);
  boardObserver.observe(board);
  disposers.push(() => {
    formObserver.disconnect();
    boardObserver.disconnect();
  });
}

/* ---------- Sticky board that never hides its own buttons ---------- */

function initBoardTop(root: HTMLElement, disposers: Cleanup[]) {
  const board = root.querySelector<HTMLElement>('[data-pl-board]');
  if (!board || !('ResizeObserver' in window)) return;
  const HEADER = 88;
  const MARGIN = 16;
  const sync = () => {
    const top = Math.min(HEADER, window.innerHeight - board.offsetHeight - MARGIN);
    board.style.setProperty('--pl-board-top', `${Math.round(top)}px`);
  };
  const observer = new ResizeObserver(sync);
  observer.observe(board);
  window.addEventListener('resize', sync);
  sync();
  disposers.push(() => {
    observer.disconnect();
    window.removeEventListener('resize', sync);
  });
}

export function initPriceListPage(): Cleanup | void {
  const root = document.querySelector<HTMLElement>('[data-pl]');
  if (!root) return;
  const reduced = prefersReduced();
  const disposers: Cleanup[] = [];

  const tool = initPriceListTool(root, reduced);
  if (tool) disposers.push(tool.cleanup);
  initHero(root, reduced, disposers);
  initAnatomy(root, reduced, disposers);
  initDock(root, disposers);
  initBoardTop(root, disposers);

  return () => disposers.forEach((dispose) => dispose());
}
