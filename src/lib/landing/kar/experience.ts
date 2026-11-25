/**
 * Client choreography for /barbershop-reports.
 *
 * - Hero: lines rise once on load; the three.js Reports chart loads after first paint, draws its
 *   ribbons in, and turns to face the viewer as the hero scrolls away (scroll-linked, hero only).
 * - Moment 1: the dashboard film. The section pins on desktop and the scroll walks five dashboard
 *   screens in sidebar order; Reports takes two beats and steps through 1D, 1W, 1M and 1Y, tweening
 *   the KPIs and morphing the chart. The reel buttons work everywhere (and are the only control on
 *   touch and under reduced motion).
 * - Moment 2: the statement's words light up with the scroll.
 * - Cards: 3 s loops, played only while on screen, restart on hover, with a pause control.
 *
 * Under prefers-reduced-motion nothing is hidden, nothing pins and nothing loops.
 * Returns a cleanup for Astro's ClientRouter (astro:before-swap).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { HeroScene } from './heroScene';
import type { KarRangeKey, KarStudioRange } from './reportsDemo';
import {
  karChartPaths,
  karKpis,
  karMetricTotal,
  karPointPercent,
  karScale,
  normalise,
  resample,
  type KarMetricKey,
} from './studioFormat';

gsap.registerPlugin(ScrollTrigger);

type Cleanup = () => void;
const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/* ---------- Hero ---------- */

function initHero(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const hero = root.querySelector<HTMLElement>('[data-kar-hero]');
  if (!hero) return;

  if (!reduced) {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(hero.querySelectorAll('[data-kar-rise]'), { y: 0, yPercent: 105 }, { y: 0, yPercent: 0, duration: 1.1, stagger: 0.12 }, 0.05)
      .fromTo(hero.querySelectorAll('[data-kar-enter]'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out' }, 0.35)
      .fromTo(hero.querySelector('[data-kar-visual]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, ease: 'power2.out' }, 0.2);
    disposers.push(() => tl.kill());
  }
  hero.classList.add('is-in');

  const canvas = hero.querySelector<HTMLCanvasElement>('[data-kar-canvas]');
  const visual = hero.querySelector<HTMLElement>('[data-kar-visual]');
  if (!canvas || !visual) return;

  let scene: HeroScene | null = null;
  let disposed = false;
  let inView = true;
  const updateRunning = () => scene?.setRunning(inView && document.visibilityState === 'visible');
  const onVisibility = () => updateRunning();
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const rect = hero.getBoundingClientRect();
    scene?.setPointer(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updateRunning();
  });

  const start = async () => {
    try {
      const { createHeroScene } = await import('./heroScene');
      if (disposed) return;
      let ribbons: number[][] = [];
      try {
        ribbons = JSON.parse(canvas.dataset.karRibbons ?? '[]');
      } catch {
        ribbons = [];
      }
      scene = createHeroScene(canvas, { reducedMotion: reduced, ribbons });
    } catch {
      scene = null;
    }
    if (!scene) {
      visual.classList.add('is-fallback');
      return;
    }
    visual.classList.add('is-live');
    io.observe(hero);
    document.addEventListener('visibilitychange', onVisibility);
    hero.addEventListener('pointermove', onPointer);
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
    if (window.cancelIdleCallback && typeof handle === 'number') window.cancelIdleCallback(handle);
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    hero.removeEventListener('pointermove', onPointer);
    scene?.dispose();
    scene = null;
  });
}

/* ---------- Moment 1: the dashboard as a film ---------- */

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
    duration: 0.6,
    ease: 'power3.out',
    onUpdate: () => { el.textContent = `${prefix}${fmt.format(state.n)}${suffix}`; },
    onComplete: () => { el.textContent = text; },
  });
}

type ReportsScreen = { setRange: (key: KarRangeKey, animate: boolean) => void; draw: () => void; dispose: Cleanup };

/** The Reports screen inside the film: range switches tween the KPIs and morph the chart. */
function createReportsScreen(screen: HTMLElement, reduced: boolean): ReportsScreen | null {
  const dataEl = screen.querySelector('[data-kar-studio-data]');
  if (!dataEl) return null;
  let data: Record<KarRangeKey, KarStudioRange>;
  try {
    data = JSON.parse(dataEl.textContent ?? '{}');
  } catch {
    return null;
  }
  const metric: KarMetricKey = 'value';
  const rangeEls = Array.from(screen.querySelectorAll<HTMLElement>('[data-kar-range]'));
  const thumb = screen.querySelector<HTMLElement>('[data-kar-range-thumb]');
  const line = screen.querySelector<SVGPathElement>('[data-kar-line]');
  const glow = screen.querySelector<SVGPathElement>('[data-kar-glow]');
  const area = screen.querySelector<SVGPathElement>('[data-kar-area]');
  const ticks = screen.querySelector<HTMLElement>('[data-kar-ticks]');
  const markers = screen.querySelector<HTMLElement>('[data-kar-markers]');
  const end = screen.querySelector<HTMLElement>('[data-kar-end]');
  const axis = screen.querySelector<HTMLElement>('[data-kar-axis]');
  const total = screen.querySelector<HTMLElement>('[data-kar-chart-total]');
  const sample = screen.querySelector<HTMLElement>('[data-kar-sample]');
  const leaders = screen.querySelector<HTMLElement>('[data-kar-leaders]');
  const stat = (key: string) => screen.querySelector<HTMLElement>(`[data-kar-stat="${key}"]`);

  let range: KarRangeKey = (rangeEls.find((el) => el.classList.contains('is-on'))?.dataset.karRange as KarRangeKey) ?? '7d';
  const scaleOf = (key: KarRangeKey) => karScale(data[key].series[metric], metric);
  let ys = normalise(resample(data[range].series[metric]), scaleOf(range).max);
  const morph = { t: 1 };

  const apply = (values: number[]) => {
    const p = karChartPaths(values);
    line?.setAttribute('d', p.line);
    glow?.setAttribute('d', p.line);
    area?.setAttribute('d', p.area);
    if (end) {
      const pt = karPointPercent(values, values.length - 1);
      end.style.left = `${pt.x}%`;
      end.style.top = `${pt.y}%`;
    }
  };

  const placeMarkers = (key: KarRangeKey) => {
    if (!markers) return;
    const raw = normalise(data[key].series[metric], scaleOf(key).max);
    markers.innerHTML = raw.length <= 14
      ? raw.map((_, i) => {
          const pt = karPointPercent(raw, i);
          return `<i style="left:${pt.x}%;top:${pt.y}%"></i>`;
        }).join('')
      : '';
  };

  const placeThumb = (animate: boolean) => {
    const el = rangeEls.find((r) => r.dataset.karRange === range);
    if (!thumb || !el) return;
    const vars = { x: el.offsetLeft, width: el.offsetWidth };
    if (animate && !reduced) gsap.to(thumb, { ...vars, duration: 0.45, ease: 'power3.out' });
    else gsap.set(thumb, vars);
  };

  const setRange = (key: KarRangeKey, animate: boolean) => {
    if (!data[key] || key === range) return;
    range = key;
    rangeEls.forEach((el) => el.classList.toggle('is-on', el.dataset.karRange === key));
    placeThumb(animate);

    const r = data[key];
    const k = karKpis(r);
    const still = reduced || !animate;
    (['bookings', 'utilisation', 'value', 'cancelled'] as const).forEach((name) => {
      const box = screen.querySelector<HTMLElement>(`[data-kar-kpi="${name}"]`);
      if (!box) return;
      tweenText(box.querySelector('[data-kar-kpi-value]'), k[name].value, still);
      const delta = box.querySelector<HTMLElement>('[data-kar-kpi-delta]');
      if (delta) {
        delta.textContent = k[name].delta;
        delta.className = `kar-kpi__delta is-${k[name].tone}`;
      }
    });
    const peak = stat('peak');
    if (peak) peak.textContent = r.peak ?? '—';
    const service = stat('service');
    if (service) service.textContent = r.popularService ?? '—';
    tweenText(stat('noshow'), k.noshow.value, still);
    const nsd = stat('noshow-delta');
    if (nsd) {
      nsd.textContent = k.noshow.delta;
      nsd.className = `is-${k.noshow.tone}`;
    }
    tweenText(total, karMetricTotal(r, metric), still);
    if (sample) sample.hidden = !r.smallSample;
    if (axis) axis.innerHTML = r.axis.map((label) => `<span>${label}</span>`).join('');
    const scale = scaleOf(key);
    if (ticks) {
      ticks.innerHTML = scale.ticks.map((t) => `<span style="top:${t.y}%"><small>${t.label}</small></span>`).join('');
    }
    if (leaders) {
      const max = Math.max(1, ...r.leaderboard.map((row) => row.count));
      leaders.innerHTML = r.leaderboard
        .map((row) => `<li><span class="kar-leaders__name">${row.name}</span><span class="kar-leaders__track"><span style="--w:${(row.count / max) * 100}%"></span></span><b>${row.count}</b></li>`)
        .join('');
      if (!still) {
        gsap.fromTo(leaders.querySelectorAll('.kar-leaders__track > span'), { scaleX: 0 }, { scaleX: 1, duration: 0.6, stagger: 0.05, ease: 'power3.out', transformOrigin: 'left center' });
      }
    }

    const target = normalise(resample(r.series[metric]), scale.max);
    const from = ys.slice();
    gsap.killTweensOf(morph);
    if (still) {
      ys = target;
      apply(ys);
      placeMarkers(key);
      return;
    }
    // Markers step aside while the line morphs, then settle on the new points.
    if (markers) gsap.to(markers, { autoAlpha: 0, duration: 0.15, overwrite: true });
    morph.t = 0;
    gsap.to(morph, {
      t: 1,
      duration: 0.7,
      ease: 'power3.inOut',
      onUpdate: () => {
        ys = from.map((v, i) => v + (target[i] - v) * morph.t);
        apply(ys);
      },
      onComplete: () => {
        placeMarkers(key);
        if (markers) gsap.fromTo(markers, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, overwrite: true });
      },
    });
  };

  /** The line draws in when the Reports screen comes up. */
  const draw = () => {
    if (reduced || !line) return;
    gsap.fromTo([line, glow], { strokeDasharray: 1, strokeDashoffset: 1, attr: { pathLength: 1 } }, {
      strokeDashoffset: 0,
      duration: 1.1,
      ease: 'power2.inOut',
      overwrite: true,
      onComplete: () => { gsap.set([line, glow], { clearProps: 'strokeDasharray,strokeDashoffset' }); },
    });
    if (area) gsap.fromTo(area, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, delay: 0.3, overwrite: true });
    if (markers) gsap.fromTo(markers.children, { scale: 0 }, { scale: 1, duration: 0.35, stagger: 0.06, delay: 0.35, ease: 'back.out(2.2)' });
    if (end) gsap.fromTo(end, { scale: 0 }, { scale: 1, duration: 0.4, delay: 1, ease: 'back.out(2.2)' });
  };

  placeThumb(false);
  const ro = new ResizeObserver(() => placeThumb(false));
  if (thumb?.parentElement) ro.observe(thumb.parentElement);
  return {
    setRange,
    draw,
    dispose: () => {
      ro.disconnect();
      gsap.killTweensOf(morph);
    },
  };
}

/** Reports gets two beats of scroll (it walks four ranges); every other screen gets one. */
const CHAPTER_WEIGHT = [1, 1, 2, 1, 1];
const REPORTS_CHAPTER = 2;
const REPORTS_RANGES: KarRangeKey[] = ['1d', '7d', '30d', '1y'];

function initFilm(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-kar-film]');
  if (!section) return;
  const pin = section.querySelector<HTMLElement>('[data-kar-film-pin]');
  const stage = section.querySelector<HTMLElement>('[data-kar-stage]');
  const app = section.querySelector<HTMLElement>('[data-kar-film-app]');
  const side = section.querySelector<HTMLElement>('[data-kar-side]');
  const glowEl = section.querySelector<HTMLElement>('[data-kar-nav-glow]');
  const reel = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-kar-reel]'));
  const fills = reel.map((btn) => btn.querySelector<HTMLElement>('[data-kar-reel-fill]'));
  const captions = Array.from(section.querySelectorAll<HTMLElement>('[data-kar-caption]'));
  const screens = Array.from(section.querySelectorAll<HTMLElement>('[data-kar-screen]'));
  const reportsEl = section.querySelector<HTMLElement>('[data-kar-reports]');
  const reports = reportsEl ? createReportsScreen(reportsEl, reduced) : null;
  const sections = captions.map((c) => c.querySelector('.kar-film__section')?.textContent?.trim() ?? '');
  const count = Math.min(captions.length, screens.length, reel.length);
  const totalWeight = CHAPTER_WEIGHT.slice(0, count).reduce((a, b) => a + b, 0);
  let current = -1;
  let pinTrigger: ScrollTrigger | null = null;

  /** Move the sidebar highlight onto the item the chapter is about, measured from the real layout. */
  const moveGlow = (index: number, animate: boolean) => {
    if (!side || !glowEl) return;
    const item = side.querySelector<HTMLElement>(`[data-kar-nav="${sections[index]}"]`);
    side.querySelectorAll('.kar-side__item').forEach((el) => el.classList.toggle('is-active', el === item));
    if (!item) return;
    const vars = { y: item.offsetTop - glowEl.offsetTop, height: item.offsetHeight };
    if (animate && !reduced) gsap.to(glowEl, { ...vars, duration: 0.5, ease: 'power3.out', overwrite: true });
    else gsap.set(glowEl, vars);
  };

  const playScreen = (screen: HTMLElement | undefined, index: number) => {
    if (!screen || reduced) return;
    const parts = screen.querySelectorAll('.kar-chips > *, .kar-timeline__row, .kar-team__row, .kar-kpi, .kar-side-stats__list > div, .kar-client > *, .kar-stats > div, .kar-minikpis > span, .kar-bars li');
    gsap.fromTo(parts, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.035, ease: 'power3.out', overwrite: true });
    const blocks = screen.querySelectorAll('.kar-block');
    if (blocks.length) gsap.fromTo(blocks, { scaleX: 0 }, { scaleX: 1, duration: 0.55, stagger: 0.012, ease: 'power3.out', transformOrigin: 'left center', overwrite: true });
    const days = screen.querySelectorAll('.kar-team__week i.is-on');
    if (days.length) gsap.fromTo(days, { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.3, stagger: 0.015, delay: 0.15, ease: 'back.out(2)', overwrite: true });
    const bars = screen.querySelectorAll('.kar-bars__track > span, .kar-leaders__track > span');
    if (bars.length) gsap.fromTo(bars, { scaleX: 0 }, { scaleX: 1, duration: 0.7, stagger: 0.06, delay: 0.1, ease: 'power3.out', transformOrigin: 'left center' });
    const score = screen.querySelector<SVGElement>('.kar-score__fill');
    if (score) gsap.fromTo(score, { '--p': 0 }, { '--p': 1, duration: 0.9, ease: 'power3.out' });
    if (index === REPORTS_CHAPTER) {
      reports?.draw();
      return;
    }
    // Any other chart on the screen (Sales) draws in the same way the dashboard's charts do.
    const pens = screen.querySelectorAll('[data-kar-draw]');
    if (pens.length) {
      gsap.fromTo(pens, { strokeDasharray: 1, strokeDashoffset: 1, attr: { pathLength: 1 } }, { strokeDashoffset: 0, duration: 1, delay: 0.15, ease: 'power2.inOut', overwrite: true });
      gsap.fromTo(screen.querySelectorAll('.kar-chart__area, .kar-chart__markers i, .kar-chart__end'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, stagger: 0.04, delay: 0.5, overwrite: true });
    }
  };

  const setChapter = (index: number) => {
    if (index === current || index < 0 || index >= count) return;
    const previous = current;
    current = index;
    reel.forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === index)));
    if (stage) stage.dataset.chapter = String(index);
    moveGlow(index, previous !== -1);

    captions.forEach((caption, i) => caption.classList.toggle('is-active', i === index));
    screens.forEach((screen, i) => screen.classList.toggle('is-active', i === index));

    if (!reduced && previous !== -1) {
      // The caption leaves upwards as the next one rises in: one direction of travel, like a reel.
      const dir = index > previous ? 1 : -1;
      gsap.fromTo(captions[index], { autoAlpha: 0, y: 18 * dir }, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out', overwrite: true });
      gsap.fromTo(captions[previous], { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -14 * dir, duration: 0.3, ease: 'power2.in', overwrite: true });
      const notes = captions[index]?.querySelectorAll('.kar-callout');
      if (notes?.length) gsap.fromTo(notes, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.1, delay: 0.25, ease: 'power3.out', overwrite: true });
    }
    playScreen(screens[index], index);
    if (index === REPORTS_CHAPTER && !pinTrigger) reports?.setRange('7d', previous !== -1);
    if (!pinTrigger) fills.forEach((fill, i) => fill && gsap.set(fill, { scaleX: i === index ? 1 : 0 }));
  };

  /** Scroll progress (0..1) → chapter and how far into it, with Reports taking two beats. */
  const locate = (progress: number) => {
    let at = progress * totalWeight;
    for (let i = 0; i < count; i += 1) {
      const w = CHAPTER_WEIGHT[i] ?? 1;
      if (at < w || i === count - 1) return { index: i, local: Math.min(1, Math.max(0, at / w)) };
      at -= w;
    }
    return { index: count - 1, local: 1 };
  };
  const startOf = (index: number) => CHAPTER_WEIGHT.slice(0, index).reduce((a, b) => a + b, 0) / totalWeight;

  setChapter(0);
  // Inactive captions collapse only once the reel works; without the script all five stay open.
  section.classList.add('is-enhanced');

  const onReel = (event: Event) => {
    const index = Number((event.currentTarget as HTMLElement).dataset.karReel);
    if (pinTrigger) {
      const { start, end } = pinTrigger;
      const w = (CHAPTER_WEIGHT[index] ?? 1) / totalWeight;
      window.scrollTo({ top: start + (startOf(index) + w * 0.35) * (end - start), behavior: reduced ? 'auto' : 'smooth' });
    } else {
      setChapter(index);
    }
  };
  reel.forEach((btn) => btn.addEventListener('click', onReel));

  // The range pills in the Reports screen answer a tap too (pointer only; the stage is decorative).
  // Pinned, a tap scrolls to that range's beat so the film and the scroll stay in step.
  const rangePills = Array.from(reportsEl?.querySelectorAll<HTMLElement>('[data-kar-range]') ?? []);
  const onRangePill = (event: Event) => {
    const key = (event.currentTarget as HTMLElement).dataset.karRange as KarRangeKey;
    const at = REPORTS_RANGES.indexOf(key);
    if (at < 0) return;
    if (pinTrigger) {
      const { start, end } = pinTrigger;
      const w = (CHAPTER_WEIGHT[REPORTS_CHAPTER] ?? 1) / totalWeight;
      window.scrollTo({ top: start + (startOf(REPORTS_CHAPTER) + ((at + 0.5) / REPORTS_RANGES.length) * w) * (end - start), behavior: reduced ? 'auto' : 'smooth' });
    } else {
      reports?.setRange(key, true);
    }
  };
  rangePills.forEach((pill) => pill.addEventListener('click', onRangePill));

  const mm = gsap.matchMedia();
  if (pin) {
    mm.add('(min-width: 1024px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)', () => {
      section.classList.add('is-pinned');
      // Opening shot: the dashboard rises out of the page and settles flat as the film starts.
      const intro = app
        ? gsap.fromTo(app, { rotateX: 16, scale: 0.88, y: 60, autoAlpha: 0.35 }, {
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
        end: () => `+=${window.innerHeight * 0.8 * totalWeight}`,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const { index, local } = locate(self.progress);
          setChapter(index);
          if (index === REPORTS_CHAPTER) {
            reports?.setRange(REPORTS_RANGES[Math.min(REPORTS_RANGES.length - 1, Math.floor(local * REPORTS_RANGES.length))], true);
          }
          fills.forEach((fill, i) => {
            if (!fill) return;
            const s = startOf(i);
            const w = (CHAPTER_WEIGHT[i] ?? 1) / totalWeight;
            gsap.set(fill, { scaleX: clamp01((self.progress - s) / w) });
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

  const onResize = () => moveGlow(Math.max(0, current), false);
  window.addEventListener('resize', onResize);

  disposers.push(() => {
    section.classList.remove('is-enhanced');
    window.removeEventListener('resize', onResize);
    mm.revert();
    reel.forEach((btn) => btn.removeEventListener('click', onReel));
    rangePills.forEach((pill) => pill.removeEventListener('click', onRangePill));
    reports?.dispose();
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
    // Fair to every chair: the shop total settles, each barber's line draws in with its chip,
    // Saturday lights up, the three end points land and the busiest chair is named. The lines then
    // run off in the same direction they drew, so the loop never snaps back.
    const total = card.querySelector('.kar-vis-chairs__total');
    const lines = Array.from(card.querySelectorAll('.kar-vis-chairs__line'));
    const dots = card.querySelectorAll('.kar-vis-chairs__dot');
    const chips = Array.from(card.querySelectorAll('.kar-vis-chairs__chip'));
    const column = card.querySelector('.kar-vis-chairs__day');
    const lead = card.querySelector('.kar-vis-chairs__lead');
    if (!lines.length) return null;
    tl.set(lines, { strokeDasharray: 1, strokeDashoffset: 1 })
      .set(dots, { scale: 0, transformOrigin: 'center' })
      .set(column, { scaleY: 0, autoAlpha: 0, transformOrigin: '50% 100%' })
      .set(chips, { autoAlpha: 0.35 })
      .set(lead, { autoAlpha: 0, x: -4 })
      .fromTo(total, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, 0);
    lines.forEach((line, i) => {
      const at = 0.25 + i * 0.28;
      tl.to(line, { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut' }, at)
        .to(chips[i], { autoAlpha: 1, duration: 0.3, ease: 'power2.out' }, at + 0.15);
    });
    tl.to(column, { scaleY: 1, autoAlpha: 1, duration: 0.5, ease: 'power3.out' }, 1.55)
      .to(dots, { scale: 1, duration: 0.35, stagger: 0.08, ease: 'back.out(2.4)' }, 1.75)
      .to(lead, { autoAlpha: 1, x: 0, duration: 0.35, ease: 'power3.out' }, 2.05)
      .to({}, { duration: 1.3 })
      .addLabel('out')
      .to(lines, { strokeDashoffset: -1, duration: 0.7, stagger: 0.06, ease: 'power2.in' }, 'out')
      .to(dots, { scale: 0, duration: 0.25, stagger: 0.04, ease: 'power2.in' }, 'out+=0.2')
      .to([column, total, lead], { autoAlpha: 0, duration: 0.35, ease: 'power1.in' }, 'out+=0.3')
      .to(chips, { autoAlpha: 0.35, duration: 0.35 }, 'out+=0.3');
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
    if (tl) loops.set(card, tl);
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
