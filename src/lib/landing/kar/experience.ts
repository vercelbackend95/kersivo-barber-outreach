/**
 * Client choreography for /barbershop-reports.
 *
 * - Hero: lines rise once on load; the three.js booking field loads after first paint and turns
 *   into a top-down heatmap as the hero scrolls away (scroll-linked inside the hero only).
 * - Moment 1: the "working day" section pins on desktop and walks four dashboard screens with the
 *   scroll; the chapter buttons work everywhere (and are the only control on touch and reduced motion).
 * - Studio: range and metric switches tween the KPI numbers and morph the chart.
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
import { karChartPaths, karKpis, karMetricTotal, normalise, resample, type KarMetricKey } from './studioFormat';

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
      scene = createHeroScene(canvas, { reducedMotion: reduced });
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

/* ---------- Moment 1: a working day ---------- */

const SIDEBAR_INDEX = [0, 4, 2, 8];

function initChapters(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-kar-chapters]');
  if (!section) return;
  const pin = section.querySelector<HTMLElement>('[data-kar-pin]');
  const stage = section.querySelector<HTMLElement>('[data-kar-stage]');
  const tabs = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-kar-tab]'));
  const panels = Array.from(section.querySelectorAll<HTMLElement>('[data-kar-panel]'));
  const fills = tabs.map((tab) => tab.querySelector<HTMLElement>('[data-kar-tab-fill]'));
  const screens = Array.from(section.querySelectorAll<HTMLElement>('[data-kar-screen]'));
  const count = tabs.length;
  let current = -1;
  let pinTrigger: ScrollTrigger | null = null;

  const playScreen = (screen: HTMLElement | undefined) => {
    if (!screen || reduced) return;
    const parts = screen.querySelectorAll('.kar-chips > *, .kar-timeline__row, .kar-client > *, .kar-stats > div, .kar-minikpis > span, .kar-bars li');
    gsap.fromTo(parts, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', overwrite: true });
    const blocks = screen.querySelectorAll('.kar-block');
    if (blocks.length) gsap.fromTo(blocks, { scaleX: 0 }, { scaleX: 1, duration: 0.55, stagger: 0.015, ease: 'power3.out', transformOrigin: 'left center', overwrite: true });
    const line = screen.querySelector('.kar-minichart__line');
    if (line) gsap.fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut' });
    const bars = screen.querySelectorAll('.kar-bars__track > span');
    if (bars.length) gsap.fromTo(bars, { scaleX: 0 }, { scaleX: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out', transformOrigin: 'left center' });
    const score = screen.querySelector<SVGElement>('.kar-score__fill');
    if (score) gsap.fromTo(score, { '--p': 0 }, { '--p': 1, duration: 0.9, ease: 'power3.out' });
  };

  const setChapter = (index: number) => {
    if (index === current) return;
    current = index;
    tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
    panels.forEach((panel, i) => panel.classList.toggle('is-active', i === index));
    if (stage) {
      stage.dataset.chapter = String(index);
      stage.style.setProperty('--kar-nav', String(SIDEBAR_INDEX[index] ?? 0));
    }
    screens.forEach((screen, i) => screen.classList.toggle('is-active', i === index));
    playScreen(screens[index]);
    if (!pinTrigger) fills.forEach((fill, i) => fill && gsap.set(fill, { scaleX: i === index ? 1 : 0 }));
  };

  setChapter(0);
  // Inactive chapter text collapses only once the buttons work; without the script all four stay open.
  section.classList.add('is-enhanced');

  const onTab = (event: Event) => {
    const index = Number((event.currentTarget as HTMLElement).dataset.karTab);
    if (pinTrigger) {
      const { start, end } = pinTrigger;
      window.scrollTo({ top: start + ((index + 0.5) / count) * (end - start), behavior: 'smooth' });
    } else {
      setChapter(index);
    }
  };
  tabs.forEach((tab) => tab.addEventListener('click', onTab));

  const mm = gsap.matchMedia();
  if (pin) {
    mm.add('(min-width: 1024px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)', () => {
      pinTrigger = ScrollTrigger.create({
        trigger: section,
        pin,
        start: 'top top',
        end: () => `+=${window.innerHeight * 2.6}`,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress * count;
          setChapter(Math.min(count - 1, Math.floor(p)));
          fills.forEach((fill, i) => fill && gsap.set(fill, { scaleX: clamp01(p - i) }));
        },
      });
      return () => {
        pinTrigger?.kill();
        pinTrigger = null;
        fills.forEach((fill, i) => fill && gsap.set(fill, { scaleX: i === current ? 1 : 0 }));
      };
    });
  }

  disposers.push(() => {
    section.classList.remove('is-enhanced');
    mm.revert();
    tabs.forEach((tab) => tab.removeEventListener('click', onTab));
  });
}

/* ---------- The live studio ---------- */

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

function initStudio(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-kar-studio]');
  const dataEl = section?.querySelector('[data-kar-studio-data]');
  if (!section || !dataEl) return;
  let data: Record<KarRangeKey, KarStudioRange>;
  try {
    data = JSON.parse(dataEl.textContent ?? '{}');
  } catch {
    return;
  }

  const rangeBtns = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-kar-range]'));
  const metricBtns = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-kar-metric]'));
  const rangeThumb = section.querySelector<HTMLElement>('[data-kar-range-thumb]');
  const metricThumb = section.querySelector<HTMLElement>('[data-kar-metric-thumb]');
  const line = section.querySelector<SVGPathElement>('[data-kar-line]');
  const area = section.querySelector<SVGPathElement>('[data-kar-area]');
  const axis = section.querySelector<HTMLElement>('[data-kar-axis]');
  const chartLabel = section.querySelector<HTMLElement>('[data-kar-chart-label]');
  const chartTotal = section.querySelector<HTMLElement>('[data-kar-chart-total]');
  const sample = section.querySelector<HTMLElement>('[data-kar-sample]');
  const leaders = section.querySelector<HTMLElement>('[data-kar-leaders]');
  const stat = (key: string) => section.querySelector<HTMLElement>(`[data-kar-stat="${key}"]`);

  let range: KarRangeKey = (rangeBtns.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.karRange as KarRangeKey) ?? '7d';
  let metric: KarMetricKey = 'bookings';
  let ys = normalise(resample(data[range].series[metric]));
  const morph = { t: 1 };

  const moveThumb = (thumb: HTMLElement | null, btn: HTMLButtonElement | undefined) => {
    if (!thumb || !btn) return;
    const x = btn.offsetLeft;
    const w = btn.offsetWidth;
    if (reduced) gsap.set(thumb, { x, width: w });
    else gsap.to(thumb, { x, width: w, duration: 0.45, ease: 'power3.out' });
  };

  const drawChart = (animate: boolean) => {
    const target = normalise(resample(data[range].series[metric]));
    const from = ys.slice();
    const apply = (values: number[]) => {
      const p = karChartPaths(values);
      line?.setAttribute('d', p.line);
      area?.setAttribute('d', p.area);
    };
    if (reduced || !animate) {
      ys = target;
      apply(ys);
      return;
    }
    gsap.killTweensOf(morph);
    morph.t = 0;
    gsap.to(morph, {
      t: 1,
      duration: 0.75,
      ease: 'power3.inOut',
      onUpdate: () => {
        ys = from.map((v, i) => v + (target[i] - v) * morph.t);
        apply(ys);
      },
    });
  };

  const render = (animate: boolean) => {
    const r = data[range];
    const k = karKpis(r);
    (['bookings', 'utilisation', 'value', 'cancelled'] as const).forEach((key) => {
      const box = section.querySelector<HTMLElement>(`[data-kar-kpi="${key}"]`);
      if (!box) return;
      tweenText(box.querySelector('[data-kar-kpi-value]'), k[key].value, reduced || !animate);
      const delta = box.querySelector<HTMLElement>('[data-kar-kpi-delta]');
      if (delta) {
        delta.textContent = k[key].delta;
        delta.className = `kar-kpi__delta is-${k[key].tone}`;
      }
    });
    const peak = stat('peak');
    if (peak) peak.textContent = r.peak ?? '—';
    const service = stat('service');
    if (service) service.textContent = r.popularService ?? '—';
    tweenText(stat('noshow'), k.noshow.value, reduced || !animate);
    const nsd = stat('noshow-delta');
    if (nsd) {
      nsd.textContent = k.noshow.delta;
      nsd.className = `is-${k.noshow.tone}`;
    }
    if (chartLabel) chartLabel.textContent = metric === 'value' ? 'Booking value' : 'Bookings';
    tweenText(chartTotal, karMetricTotal(r, metric), reduced || !animate);
    if (sample) sample.hidden = !r.smallSample;
    if (axis) axis.innerHTML = r.axis.map((label) => `<span>${label}</span>`).join('');

    if (leaders) {
      const max = Math.max(1, ...r.leaderboard.map((row) => row.count));
      leaders.innerHTML = r.leaderboard
        .map((row) => `<li><span class="kar-leaders__name">${row.name}</span><span class="kar-leaders__track"><span style="--w:${(row.count / max) * 100}%"></span></span><b>${row.count}</b></li>`)
        .join('');
      if (!reduced && animate) {
        gsap.fromTo(leaders.querySelectorAll('.kar-leaders__track > span'), { scaleX: 0 }, { scaleX: 1, duration: 0.6, stagger: 0.05, ease: 'power3.out', transformOrigin: 'left center' });
      }
    }
    drawChart(animate);
  };

  const onRange = (event: Event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    const next = btn.dataset.karRange as KarRangeKey;
    if (!data[next] || next === range) return;
    range = next;
    rangeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    moveThumb(rangeThumb, btn);
    render(true);
  };
  const onMetric = (event: Event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    const next = btn.dataset.karMetric as KarMetricKey;
    if (next === metric) return;
    metric = next;
    metricBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    moveThumb(metricThumb, btn);
    render(true);
  };

  rangeBtns.forEach((b) => b.addEventListener('click', onRange));
  metricBtns.forEach((b) => b.addEventListener('click', onMetric));

  const placeThumbs = () => {
    const r = rangeBtns.find((b) => b.getAttribute('aria-pressed') === 'true');
    const m = metricBtns.find((b) => b.getAttribute('aria-pressed') === 'true');
    if (rangeThumb && r) gsap.set(rangeThumb, { x: r.offsetLeft, width: r.offsetWidth });
    if (metricThumb && m) gsap.set(metricThumb, { x: m.offsetLeft, width: m.offsetWidth });
  };
  placeThumbs();
  section.classList.add('is-enhanced');
  const ro = new ResizeObserver(placeThumbs);
  rangeBtns[0]?.parentElement && ro.observe(rangeBtns[0].parentElement);

  // The chart draws in once, when the studio arrives.
  if (!reduced && line) {
    gsap.set(line, { strokeDasharray: 1, strokeDashoffset: 1, attr: { pathLength: 1 } });
    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top 65%',
      once: true,
      onEnter: () => {
        gsap.to(line, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut', onComplete: () => gsap.set(line, { clearProps: 'strokeDasharray,strokeDashoffset' }) });
        if (area) gsap.fromTo(area, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, delay: 0.4 });
      },
    });
    disposers.push(() => st.kill());
  }

  disposers.push(() => {
    ro.disconnect();
    rangeBtns.forEach((b) => b.removeEventListener('click', onRange));
    metricBtns.forEach((b) => b.removeEventListener('click', onMetric));
    gsap.killTweensOf(morph);
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
    const paths = card.querySelectorAll('.kar-vis-lines path');
    tl.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 })
      .to(paths, { strokeDashoffset: 0, duration: 1.1, stagger: 0.25, ease: 'power2.inOut' }, 0.1)
      .to({}, { duration: 1.2 })
      .to(paths, { autoAlpha: 0, duration: 0.3 })
      .set(paths, { autoAlpha: 1, strokeDashoffset: 1 });
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
  initChapters(root, reduced, disposers);
  initStudio(root, reduced, disposers);
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
