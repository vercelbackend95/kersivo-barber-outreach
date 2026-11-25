/**
 * Client choreography for /barbershop-reports.
 *
 * - Hero: lines rise once on load; the three.js Reports chart (one series) loads after first
 *   paint and draws in from the left, and four widgets with the rest of Reports land around it.
 *   Every few seconds the range widget moves on (1W → 1M → 1Y → 1D): the line draws the new
 *   range from the left and every widget counts to its new figure. The camera turns to face the
 *   chart as the hero scrolls away.
 * - Moment 1: the dashboard film. The real KERSIVO owner dashboard (Heritage Grooming demo) loads
 *   in a frame near the section; on desktop the section pins and the scroll walks five sidebar
 *   sections, each playing a short script of real clicks (filmDirector.ts). Elsewhere the film
 *   plays on its own while in view, and the reel buttons pick a chapter.
 * - Moment 2: the statement's words light up with the scroll.
 * - Cards: short loops, played only while on screen, restart on hover, with a pause control.
 *
 * Under prefers-reduced-motion nothing is hidden, nothing pins, nothing loops and no cursor plays.
 * Returns a cleanup for Astro's ClientRouter (astro:before-swap).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HERO_SHOWCASE_READY_MESSAGE_TYPE, HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE } from '@/lib/admin/heroShowcase';
import { mountDeferredDemoFrame } from '@/lib/performance/deferredDemoFrame';
import type { HeroScene } from './heroScene';
import type { FilmDirector } from './filmDirector';

gsap.registerPlugin(ScrollTrigger);

type Cleanup = () => void;
const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Animate a formatted figure by tweening the number inside it and keeping its prefix and suffix. */
function tweenText(el: HTMLElement | null, text: string, reduced: boolean) {
  if (!el || el.textContent === text) return;
  const match = text.match(/^([^\d−-]*)([−-]?[\d,]+(?:\.\d+)?)(.*)$/);
  const prevMatch = (el.textContent ?? '').match(/([\d,]+(?:\.\d+)?)/);
  if (reduced || !match || !prevMatch) {
    el.textContent = text;
    return;
  }
  const [, prefix, rawTo, suffix] = match;
  const to = Number(rawTo.replace(/,/g, '').replace('−', '-'));
  const from = Number(prevMatch[1].replace(/,/g, ''));
  const decimals = rawTo.includes('.') ? rawTo.split('.')[1].length : 0;
  const fmt = new Intl.NumberFormat('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const state = { n: from };
  gsap.killTweensOf(state);
  gsap.to(state, {
    n: Math.abs(to),
    duration: 0.7,
    ease: 'power3.out',
    onUpdate: () => { el.textContent = `${prefix}${fmt.format(state.n)}${suffix}`; },
    onComplete: () => { el.textContent = text; },
  });
}

/** Swap a short label with a quick vertical crossfade. */
function swapText(el: HTMLElement | null, text: string, reduced: boolean) {
  if (!el || el.textContent === text) return;
  if (reduced) {
    el.textContent = text;
    return;
  }
  gsap.to(el, {
    autoAlpha: 0,
    y: -6,
    duration: 0.18,
    ease: 'power2.in',
    overwrite: true,
    onComplete: () => {
      el.textContent = text;
      gsap.fromTo(el, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.32, ease: 'power3.out' });
    },
  });
}

/* ---------- Hero ---------- */

type HeroRange = {
  key: string;
  short: string;
  total: string;
  bookings: string;
  bookingsDelta: string;
  bookingsTone: string;
  util: number;
  utilLabel: string;
  utilDelta: string;
  utilTone: string;
  cancelled: string;
  cancelledDelta: string;
  cancelledTone: string;
  peak: string;
  service: string;
  leaders: { name: string; count: number; share: number }[];
  series: number[];
};

/** The order the hero walks the ranges in, starting from the week it renders with. */
const HERO_CYCLE = ['7d', '30d', '1y', '1d'];
const HERO_HOLD_MS = 5200;

function initHero(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const hero = root.querySelector<HTMLElement>('[data-kar-hero]');
  if (!hero) return;
  const board = hero.querySelector<HTMLElement>('[data-kar-board]');
  const widgets = Array.from(hero.querySelectorAll<HTMLElement>('[data-kar-w]'));
  let ranges: HeroRange[] = [];
  try {
    ranges = JSON.parse(hero.querySelector('[data-kar-hero-data]')?.textContent ?? '[]');
  } catch {
    ranges = [];
  }
  const byKey = new Map(ranges.map((r) => [r.key, r]));

  if (!reduced) {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(hero.querySelectorAll('[data-kar-rise]'), { y: 0, yPercent: 105 }, { y: 0, yPercent: 0, duration: 1.1, stagger: 0.12 }, 0.05)
      .fromTo(hero.querySelectorAll('[data-kar-enter]'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out' }, 0.35)
      .fromTo(hero.querySelector('[data-kar-visual]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, ease: 'power2.out' }, 0.2)
      // The widgets land around the chart once its line is on its way.
      .fromTo(widgets, { autoAlpha: 0, y: 18, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, stagger: 0.12, ease: 'power3.out' }, 0.9);
    disposers.push(() => tl.kill());
  }
  hero.classList.add('is-in');

  /* Widgets: one place that knows how to show a range. */
  const hv = (key: string) => board?.querySelector<HTMLElement>(`[data-kar-hv="${key}"]`) ?? null;
  const ring = board?.querySelector<HTMLElement>('[data-kar-hring]');
  const leaders = board?.querySelector<HTMLElement>('[data-kar-hleaders]');
  const pills = Array.from(board?.querySelectorAll<HTMLElement>('[data-kar-hrange]') ?? []);
  const thumb = board?.querySelector<HTMLElement>('[data-kar-hthumb]');
  let currentKey = pills.find((p) => p.classList.contains('is-on'))?.dataset.karHrange ?? HERO_CYCLE[0];

  const placeThumb = (animate: boolean) => {
    const pill = pills.find((p) => p.dataset.karHrange === currentKey);
    if (!thumb || !pill) return;
    const vars = { x: pill.offsetLeft, width: pill.offsetWidth };
    if (animate && !reduced) gsap.to(thumb, { ...vars, duration: 0.5, ease: 'power3.inOut', overwrite: true });
    else gsap.set(thumb, vars);
  };

  const tone = (el: HTMLElement | null, base: string, value: string) => {
    if (el) el.className = `${base} is-${value}`;
  };

  const showRange = (key: string) => {
    const r = byKey.get(key);
    if (!r || key === currentKey) return;
    currentKey = key;
    pills.forEach((p) => p.classList.toggle('is-on', p.dataset.karHrange === key));
    placeThumb(true);
    tweenText(hv('total'), r.total, reduced);
    tweenText(hv('bookings'), r.bookings, reduced);
    swapText(hv('bookingsDelta'), r.bookingsDelta, reduced);
    tone(hv('bookingsDelta'), 'kar-w__delta', r.bookingsTone);
    tweenText(hv('utilLabel'), r.utilLabel, reduced);
    swapText(hv('utilDelta'), r.utilDelta, reduced);
    tone(hv('utilDelta'), 'kar-w__delta', r.utilTone);
    if (ring) {
      if (reduced) ring.style.setProperty('--p', String(r.util / 100));
      else gsap.to(ring, { '--p': r.util / 100, duration: 0.9, ease: 'power3.inOut' });
    }
    tweenText(hv('cancelled'), r.cancelled, reduced);
    swapText(hv('cancelledDelta'), r.cancelledDelta, reduced);
    tone(hv('cancelledDelta'), '', r.cancelledTone);
    swapText(hv('peak'), r.peak, reduced);
    swapText(hv('service'), r.service, reduced);
    if (leaders) {
      leaders.innerHTML = r.leaders
        .map((row, i) => `<li><span class="kar-w__rank">${i + 1}</span><span class="kar-w__name">${row.name}</span><span class="kar-w__bar"><span style="--w:${row.share}%"></span></span><b>${row.count}</b></li>`)
        .join('');
      if (!reduced) {
        gsap.fromTo(leaders.querySelectorAll('li'), { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.06, ease: 'power3.out' });
        gsap.fromTo(leaders.querySelectorAll('.kar-w__bar > span'), { scaleX: 0 }, { scaleX: 1, duration: 0.8, stagger: 0.07, delay: 0.1, ease: 'power3.out', transformOrigin: 'left center' });
      }
    }
    scene?.setSeries(r.series);
  };

  placeThumb(false);
  const thumbRo = new ResizeObserver(() => placeThumb(false));
  if (thumb?.parentElement) thumbRo.observe(thumb.parentElement);
  disposers.push(() => thumbRo.disconnect());

  /* The chart. */
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-kar-canvas]');
  const visual = hero.querySelector<HTMLElement>('[data-kar-visual]');
  let scene: HeroScene | null = null;
  let disposed = false;
  let inView = true;
  let cycleTimer: number | undefined;

  const stopCycle = () => {
    window.clearTimeout(cycleTimer);
    cycleTimer = undefined;
  };
  const scheduleCycle = () => {
    stopCycle();
    if (reduced || !inView || document.visibilityState !== 'visible' || ranges.length < 2) return;
    cycleTimer = window.setTimeout(() => {
      const at = HERO_CYCLE.indexOf(currentKey);
      showRange(HERO_CYCLE[(at + 1) % HERO_CYCLE.length]!);
      scheduleCycle();
    }, HERO_HOLD_MS);
  };

  const updateRunning = () => {
    scene?.setRunning(inView && document.visibilityState === 'visible');
    scheduleCycle();
  };
  const onVisibility = () => updateRunning();
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    scene?.setPointer(x, y);
    // The widgets float at slightly different depths over the chart.
    widgets.forEach((w, i) => {
      const depth = 4 + (i % 2) * 3;
      gsap.to(w, { xPercent: 0, x: x * depth, y: y * depth * 0.6, duration: 0.8, ease: 'power3.out', overwrite: 'auto' });
    });
  };
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updateRunning();
  });
  io.observe(hero);
  document.addEventListener('visibilitychange', onVisibility);
  if (!reduced) hero.addEventListener('pointermove', onPointer);

  const start = async () => {
    if (!canvas || !visual) return;
    try {
      const { createHeroScene } = await import('./heroScene');
      if (disposed) return;
      scene = createHeroScene(canvas, { reducedMotion: reduced, series: byKey.get(currentKey)?.series ?? [] });
    } catch {
      scene = null;
    }
    if (!scene) {
      visual.classList.add('is-fallback');
      return;
    }
    visual.classList.add('is-live');
    updateRunning();
    const st = ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: 'bottom top',
      onUpdate: (self) => scene?.setProgress(self.progress),
    });
    disposers.push(() => st.kill());
  };

  const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
  const handle = idle(() => void start());

  disposers.push(() => {
    disposed = true;
    stopCycle();
    if (window.cancelIdleCallback && typeof handle === 'number') window.cancelIdleCallback(handle);
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    hero.removeEventListener('pointermove', onPointer);
    scene?.dispose();
    scene = null;
  });
}

/* ---------- Moment 1: the real dashboard as a film ---------- */

/** Reports gets two beats of scroll (it walks four ranges); every other screen gets one. */
const CHAPTER_WEIGHT = [1, 1, 2, 1, 1];

function initFilm(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-kar-film]');
  if (!section) return;
  const pin = section.querySelector<HTMLElement>('[data-kar-film-pin]');
  const stage = section.querySelector<HTMLElement>('[data-kar-stage]');
  const app = section.querySelector<HTMLElement>('[data-kar-film-app]');
  const live = section.querySelector<HTMLElement>('[data-kar-live]');
  const canvas = section.querySelector<HTMLElement>('[data-kar-live-canvas]');
  const fx = section.querySelector<HTMLElement>('[data-kar-fx]');
  const frame = live?.querySelector<HTMLIFrameElement>('iframe') ?? null;
  const reel = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-kar-reel]'));
  const fills = reel.map((btn) => btn.querySelector<HTMLElement>('[data-kar-reel-fill]'));
  const captions = Array.from(section.querySelectorAll<HTMLElement>('[data-kar-caption]'));
  const count = Math.min(captions.length, reel.length);
  const totalWeight = CHAPTER_WEIGHT.slice(0, count).reduce((a, b) => a + b, 0);
  let current = -1;
  let pinTrigger: ScrollTrigger | null = null;
  let director: FilmDirector | null = null;
  let frameReady = false;
  let inView = false;
  let autoplay = false;

  const startOf = (index: number) => CHAPTER_WEIGHT.slice(0, index).reduce((a, b) => a + b, 0) / totalWeight;

  const syncDirector = () => director?.setRunning(frameReady && inView && document.visibilityState === 'visible');

  const setChapter = (index: number) => {
    if (index === current || index < 0 || index >= count) return;
    const previous = current;
    current = index;
    reel.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === index)));
    if (stage) stage.dataset.chapter = String(index);
    captions.forEach((caption, i) => caption.classList.toggle('is-active', i === index));

    if (!reduced && previous !== -1) {
      // The caption leaves upwards as the next one rises in: one direction of travel, like a reel.
      const dir = index > previous ? 1 : -1;
      gsap.fromTo(captions[index], { autoAlpha: 0, y: 18 * dir }, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out', overwrite: true });
      gsap.fromTo(captions[previous], { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -14 * dir, duration: 0.3, ease: 'power2.in', overwrite: true });
      const notes = captions[index]?.querySelectorAll('.kar-callout');
      if (notes?.length) gsap.fromTo(notes, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.1, delay: 0.25, ease: 'power3.out', overwrite: true });
    }
    director?.play(index);
    if (!pinTrigger) fills.forEach((fill, i) => fill && gsap.set(fill, { scaleX: i === index ? 1 : 0 }));
  };

  /** Scroll progress (0..1) → chapter, with Reports taking two beats. */
  const locate = (progress: number) => {
    let at = progress * totalWeight;
    for (let i = 0; i < count; i += 1) {
      const w = CHAPTER_WEIGHT[i] ?? 1;
      if (at < w || i === count - 1) return i;
      at -= w;
    }
    return count - 1;
  };

  setChapter(0);
  // Inactive captions collapse only once the reel works; without the script all five stay open.
  section.classList.add('is-enhanced');

  const onReel = (event: Event) => {
    const index = Number((event.currentTarget as HTMLElement).dataset.karReel);
    autoplay = false;
    if (pinTrigger) {
      const { start, end } = pinTrigger;
      const w = (CHAPTER_WEIGHT[index] ?? 1) / totalWeight;
      window.scrollTo({ top: start + (startOf(index) + w * 0.2) * (end - start), behavior: reduced ? 'auto' : 'smooth' });
    } else {
      setChapter(index);
    }
  };
  reel.forEach((btn) => btn.addEventListener('click', onReel));

  /* The real dashboard: loaded near the section, directed once it says it is ready. */
  if (live && frame && canvas && fx && stage) {
    const stopFrame = mountDeferredDemoFrame(live, window, { readyMessageType: HERO_SHOWCASE_READY_MESSAGE_TYPE, rootMargin: '600px 0px' });
    disposers.push(stopFrame);
    let disposed = false;
    const boot = async () => {
      const { createFilmDirector } = await import('./filmDirector');
      if (disposed || director) return;
      director = createFilmDirector({
        stage: live,
        canvas,
        frame,
        fx,
        reduced,
        // Not pinned: when a chapter has shown itself once, the film moves on by itself.
        onPass: (index) => {
          if (!autoplay || pinTrigger) return;
          setChapter((index + 1) % count);
        },
      });
      director.play(Math.max(0, current));
      syncDirector();
      // The embed's own timeline starts its scroll once it is told it is on screen.
      frame.contentWindow?.postMessage({ type: HERO_SHOWCASE_VISIBLE_MESSAGE_TYPE }, window.location.origin);
    };
    const mo = new MutationObserver(() => {
      if (live.dataset.frameState !== 'ready' || frameReady) return;
      frameReady = true;
      mo.disconnect();
      void boot();
    });
    mo.observe(live, { attributes: true, attributeFilter: ['data-frame-state'] });
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncDirector();
    }, { threshold: 0.35 });
    io.observe(live);
    const onVisibility = () => syncDirector();
    document.addEventListener('visibilitychange', onVisibility);
    disposers.push(() => {
      disposed = true;
      mo.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      director?.dispose();
      director = null;
    });
  }

  const mm = gsap.matchMedia();
  // Not pinned (touch, small screens): the film plays through the chapters on its own.
  mm.add('(max-width: 1023px), (max-height: 639px)', () => {
    autoplay = !reduced;
    return () => { autoplay = false; };
  });
  if (pin) {
    mm.add('(min-width: 1024px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)', () => {
      section.classList.add('is-pinned');
      // Opening shot: the dashboard rises out of the page and settles flat as the film starts.
      const intro = app
        ? gsap.fromTo(app, { rotateX: 14, scale: 0.9, y: 60, autoAlpha: 0.35 }, {
            rotateX: 0,
            scale: 1,
            y: 0,
            autoAlpha: 1,
            ease: 'none',
            scrollTrigger: { trigger: pin, start: 'top 85%', end: 'top top', scrub: 0.6 },
          })
        : null;
      pinTrigger = ScrollTrigger.create({
        trigger: pin,
        pin,
        start: 'top top',
        // The scripts need time to play, so each beat is a little over a screen of scroll.
        end: () => `+=${window.innerHeight * 1.1 * totalWeight}`,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          setChapter(locate(self.progress));
          fills.forEach((fill, i) => {
            if (!fill) return;
            const w = (CHAPTER_WEIGHT[i] ?? 1) / totalWeight;
            gsap.set(fill, { scaleX: clamp01((self.progress - startOf(i)) / w) });
          });
        },
      });
      return () => {
        section.classList.remove('is-pinned');
        intro?.scrollTrigger?.kill();
        intro?.kill();
        if (app) gsap.set(app, { clearProps: 'all' });
        pinTrigger?.kill();
        pinTrigger = null;
        fills.forEach((fill, i) => fill && gsap.set(fill, { scaleX: i === current ? 1 : 0 }));
      };
    });
  }

  disposers.push(() => {
    section.classList.remove('is-enhanced');
    mm.revert();
    reel.forEach((btn) => btn.removeEventListener('click', onReel));
  });
}

/* ---------- Moment 2: the statement lights up ---------- */

function initStatement(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-kar-statement]');
  if (!section || reduced) return;
  const tween = gsap.fromTo(
    section.querySelectorAll('[data-kar-word]'),
    { opacity: 0.16 },
    { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: section, start: 'top 70%', end: 'bottom 55%', scrub: 0.4 } },
  );
  disposers.push(() => {
    tween.scrollTrigger?.kill();
    tween.kill();
  });
}

/* ---------- Cards: short loops ---------- */

/** Measure an SVG path and hide it as an undrawn dash (real lengths, so the draw is a true pen). */
function primeDraw(path: SVGGeometryElement): number {
  path.removeAttribute('pathLength');
  const length = Math.ceil(path.getTotalLength()) + 2;
  path.style.strokeDasharray = `${length} ${length}`;
  path.style.strokeDashoffset = String(length);
  return length;
}

function buildLoop(card: HTMLElement): gsap.core.Timeline | null {
  const id = card.dataset.karCard;
  const tl = gsap.timeline({ repeat: -1, paused: true, defaults: { ease: 'power3.out' } });

  if (id === 'compare') {
    const now = card.querySelector<HTMLElement>('[data-kar-count]');
    const chip = card.querySelector('.kar-vis-compare__chip');
    const prev = card.querySelector('.kar-vis-compare__prev');
    if (!now) return null;
    const state = { n: 66.1 };
    tl.set(state, { n: 66.1 })
      .set(chip, { autoAlpha: 0, scale: 0.8 })
      .fromTo(prev, { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.4 }, 0.1)
      .to(state, { n: 72.3, duration: 1, ease: 'power2.out', onUpdate: () => { now.textContent = `${state.n.toFixed(1)}%`; } }, 0.4)
      .to(chip, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, 1.3)
      .to({}, { duration: 1.3 });
  } else if (id === 'sample') {
    const dots = card.querySelectorAll('.kar-vis-sample__dots i');
    const flag = card.querySelector('.kar-vis-sample__flag');
    tl.set(dots, { className: '' })
      .set(flag, { autoAlpha: 0, y: 6 })
      .to(Array.from(dots).slice(0, 6), { className: 'is-on', duration: 0.01, stagger: 0.16 }, 0.2)
      .to(flag, { autoAlpha: 1, y: 0, duration: 0.35 }, '+=0.2')
      .to({}, { duration: 1.4 })
      .to(flag, { autoAlpha: 0, duration: 0.25 });
  } else if (id === 'utilisation') {
    const fill = card.querySelector('.kar-vis-util__fill');
    tl.set(fill, { strokeDashoffset: 100 })
      .to(fill, { strokeDashoffset: 28, duration: 1.3, ease: 'power2.out' }, 0.2)
      .to({}, { duration: 1.5 })
      .to(fill, { strokeDashoffset: 100, duration: 0.4, ease: 'power2.in' });
  } else if (id === 'barbers') {
    // Fair to every chair: one pen sweeps the week from Tuesday to Saturday. The shop total
    // fills in behind it, then each barber's line is drawn left to right (measured dash lengths,
    // so the stroke grows rather than appears), each end point lands as its pen arrives,
    // Saturday lights up and the busiest chair is named. The loop then fades out and starts again.
    const total = card.querySelector<SVGPathElement>('.kar-vis-chairs__total');
    const lines = Array.from(card.querySelectorAll<SVGPathElement>('.kar-vis-chairs__line'));
    const dots = Array.from(card.querySelectorAll('.kar-vis-chairs__dot'));
    const chips = Array.from(card.querySelectorAll('.kar-vis-chairs__chip'));
    const column = card.querySelector('.kar-vis-chairs__day');
    const lead = card.querySelector('.kar-vis-chairs__lead');
    const sweep = card.querySelector<SVGRectElement>('.kar-vis-chairs__sweep');
    if (!lines.length) return null;
    const lengths = lines.map((line) => primeDraw(line));
    card.classList.add('is-primed');
    const DRAW = 1.5;
    tl.set(lines, { autoAlpha: 1 })
      .set(lines, { strokeDashoffset: (i: number) => lengths[i] })
      .set(dots, { scale: 0, transformOrigin: 'center', transformBox: 'fill-box' })
      .set(column, { scaleY: 0, autoAlpha: 0, transformOrigin: '50% 100%', transformBox: 'fill-box' })
      .set(chips, { autoAlpha: 0.35 })
      .set(lead, { autoAlpha: 0, x: -4 })
      .set(total, { autoAlpha: 1 });
    if (sweep) tl.fromTo(sweep, { attr: { width: 0 } }, { attr: { width: 228 }, duration: DRAW + 0.5, ease: 'power1.inOut' }, 0);
    else tl.fromTo(total, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, 0);
    lines.forEach((line, i) => {
      const at = 0.15 + i * 0.22;
      tl.to(line, { strokeDashoffset: 0, duration: DRAW, ease: 'power1.inOut' }, at)
        .to(chips[i] ?? {}, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' }, at + 0.1)
        .to(dots[i] ?? {}, { scale: 1, duration: 0.35, ease: 'back.out(2.4)' }, at + DRAW - 0.05);
    });
    const done = 0.15 + (lines.length - 1) * 0.22 + DRAW;
    tl.to(column, { scaleY: 1, autoAlpha: 1, duration: 0.5, ease: 'power3.out' }, done - 0.2)
      .to(lead, { autoAlpha: 1, x: 0, duration: 0.35, ease: 'power3.out' }, done + 0.1)
      .to({}, { duration: 1.6 })
      .addLabel('out')
      .to([...lines, ...dots, column, lead], { autoAlpha: 0, duration: 0.45, ease: 'power1.in' }, 'out')
      .to(total, { autoAlpha: 0, duration: 0.45, ease: 'power1.in' }, 'out')
      .to(chips, { autoAlpha: 0.35, duration: 0.35 }, 'out+=0.1')
      .to({}, { duration: 0.25 });
  } else {
    return null;
  }
  return tl;
}

function initCards(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-kar-features]');
  if (!section) return;
  const pauseBtn = section.querySelector<HTMLButtonElement>('[data-kar-pause]');
  if (reduced) {
    if (pauseBtn) pauseBtn.hidden = true;
    return;
  }
  const cards = Array.from(section.querySelectorAll<HTMLElement>('[data-kar-card]'));
  const loops = new Map<HTMLElement, gsap.core.Timeline>();
  const visible = new Set<HTMLElement>();
  let paused = false;
  cards.forEach((card) => {
    const tl = buildLoop(card);
    if (tl) {
      // Put every card in its first frame now, so nothing shows finished and then snaps back.
      tl.progress(0).pause();
      loops.set(card, tl);
    }
  });
  const sync = () => loops.forEach((tl, card) => (visible.has(card) && !paused ? tl.play() : tl.pause()));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const card = entry.target as HTMLElement;
      if (entry.isIntersecting) visible.add(card);
      else visible.delete(card);
    });
    sync();
  }, { threshold: 0.35 });
  cards.forEach((card) => io.observe(card));
  const onEnter = (event: Event) => {
    if (!paused) loops.get(event.currentTarget as HTMLElement)?.restart();
  };
  cards.forEach((card) => card.addEventListener('pointerenter', onEnter));
  const onPause = () => {
    paused = !paused;
    pauseBtn?.setAttribute('aria-pressed', String(paused));
    const label = pauseBtn?.querySelector('[data-kar-pause-label]');
    if (label) label.textContent = paused ? 'Play animations' : 'Pause animations';
    sync();
  };
  pauseBtn?.addEventListener('click', onPause);
  disposers.push(() => {
    io.disconnect();
    cards.forEach((card) => card.removeEventListener('pointerenter', onEnter));
    pauseBtn?.removeEventListener('click', onPause);
    loops.forEach((tl) => tl.kill());
  });
}

/* ---------- Entry ---------- */

export function initAdminReports(root: HTMLElement): Cleanup {
  const reduced = prefersReduced();
  const disposers: Cleanup[] = [];

  initHero(root, reduced, disposers);
  initFilm(root, reduced, disposers);
  initStatement(root, reduced, disposers);
  initCards(root, reduced, disposers);

  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(refresh).catch(() => {});
  window.addEventListener('load', refresh, { once: true });

  return () => {
    window.removeEventListener('load', refresh);
    disposers.reverse().forEach((dispose) => dispose());
    document.documentElement.classList.remove('kar-js');
    delete root.dataset.karBound;
  };
}
