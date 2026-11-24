/**
 * Client choreography for /kersivo-vs-booksy.
 *
 * - Hero: lines rise once on load; the three.js globe loads after first paint and scatters as the
 *   hero scrolls away (scroll-linked inside the hero only).
 * - Moment 1: the "two models" section pins on desktop and walks three chapters with the scroll;
 *   the chapter buttons work everywhere (and are the only control on touch and reduced motion).
 * - The bill: live sums with tweened numbers and segments that drop in per barber.
 * - Moment 2: the statement's words light up with the scroll.
 * - Feature cards: 3 s loops, played only while on screen, restart on hover, with a pause control.
 *
 * Under prefers-reduced-motion nothing is hidden, nothing pins and nothing loops.
 * Returns a cleanup for Astro's ClientRouter (astro:before-swap).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { BK_TEAM_MAX, estimateBill, estimateBoost, formatGbp } from '@/lib/landing/booksyMath';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { KVB_CHAPTERS } from '@/lib/seo/kersivoVsBooksyExperience';
import type { HeroScene } from './heroScene';

gsap.registerPlugin(ScrollTrigger);

const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const money = (n: number) => formatGbp(Math.round(n * 100) / 100);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

type Cleanup = () => void;

/* ---------- Hero ---------- */

function initHero(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const hero = root.querySelector<HTMLElement>('[data-kvb-hero]');
  if (!hero) return;

  if (!reduced) {
    const rise = hero.querySelectorAll('[data-kvb-rise]');
    const enter = hero.querySelectorAll('[data-kvb-enter]');
    const visual = hero.querySelector('[data-kvb-visual]');
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    // y: 0 clears the CSS pre-hide offset, which GSAP would otherwise cache as pixels.
    tl.fromTo(rise, { y: 0, yPercent: 105 }, { y: 0, yPercent: 0, duration: 1.1, stagger: 0.12 }, 0.05)
      .fromTo(enter, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out' }, 0.35)
      .fromTo(visual, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 1.6, ease: 'power2.out' }, 0.2);
    hero.classList.add('is-in');
    disposers.push(() => tl.kill());
  } else {
    hero.classList.add('is-in');
  }

  // three.js loads after first paint so it never competes with the headline.
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-kvb-canvas]');
  const visual = hero.querySelector<HTMLElement>('[data-kvb-visual]');
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

/* ---------- Moment 1: two models, three chapters ---------- */

const MARKET_CHIPS = KVB_CHAPTERS.map((chapter) => chapter.marketChip);
const OWN_CHIPS = KVB_CHAPTERS.map((chapter) => chapter.ownChip);

function initChapters(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-kvb-chapters]');
  if (!section) return;
  const pin = section.querySelector<HTMLElement>('[data-kvb-pin]');
  const stage = section.querySelector<HTMLElement>('[data-kvb-stage]');
  const tabs = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-kvb-tab]'));
  const panels = Array.from(section.querySelectorAll<HTMLElement>('[data-kvb-panel]'));
  const fills = tabs.map((tab) => tab.querySelector<HTMLElement>('[data-kvb-tab-fill]'));
  const marketChip = section.querySelector<HTMLElement>('[data-kvb-market-chip]');
  const ownChip = section.querySelector<HTMLElement>('[data-kvb-own-chip]');
  const count = tabs.length;
  let current = 0;
  let pinTrigger: ScrollTrigger | null = null;

  const swapText = (el: HTMLElement | null, text: string) => {
    if (!el || el.textContent === text) return;
    if (reduced) {
      el.textContent = text;
      return;
    }
    gsap.timeline()
      .to(el, { yPercent: -60, autoAlpha: 0, duration: 0.16, ease: 'power2.in' })
      .call(() => { el.textContent = text; })
      .fromTo(el, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.32, ease: 'power3.out' });
  };

  const setChapter = (index: number) => {
    if (index === current) return;
    current = index;
    tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
    panels.forEach((panel, i) => {
      panel.hidden = i !== index;
      if (i === index && !reduced) {
        gsap.fromTo(panel.querySelectorAll('.kvb-model__side'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.07, ease: 'power3.out' });
      }
    });
    if (stage) stage.dataset.chapter = String(index);
    swapText(marketChip, MARKET_CHIPS[index] ?? '');
    swapText(ownChip, OWN_CHIPS[index] ?? '');
    if (!pinTrigger) fills.forEach((fill, i) => fill && gsap.set(fill, { scaleX: i === index ? 1 : 0 }));
  };

  // Without the pin, the active tab shows a full bar.
  fills.forEach((fill, i) => fill && gsap.set(fill, { scaleX: i === 0 ? 1 : 0 }));

  const onTab = (event: Event) => {
    const index = Number((event.currentTarget as HTMLElement).dataset.kvbTab);
    if (pinTrigger) {
      const { start, end } = pinTrigger;
      const target = start + ((index + 0.5) / count) * (end - start);
      window.scrollTo({ top: target, behavior: 'smooth' });
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
        end: () => `+=${window.innerHeight * 2.2}`,
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
    mm.revert();
    tabs.forEach((tab) => tab.removeEventListener('click', onTab));
  });
}

/* ---------- The bill ---------- */

function tweenNumber(el: HTMLElement | null, to: number, reduced: boolean, tweens: WeakMap<HTMLElement, gsap.core.Tween>) {
  if (!el) return;
  const from = Number(el.dataset.value ?? to);
  el.dataset.value = String(to);
  tweens.get(el)?.kill();
  if (reduced || from === to) {
    el.textContent = money(to);
    return;
  }
  const state = { n: from };
  tweens.set(el, gsap.to(state, {
    n: to,
    duration: 0.55,
    ease: 'power3.out',
    onUpdate: () => { el.textContent = money(state.n); },
    onComplete: () => { el.textContent = money(to); },
  }));
}

function initBill(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-kvb-bill]');
  if (!section) return;
  const q = <T extends Element>(sel: string) => section.querySelector<T>(sel);
  const team = q<HTMLInputElement>('[data-kvb-team]');
  const teamOut = q<HTMLElement>('[data-kvb-team-out]');
  const toggle = q<HTMLInputElement>('[data-kvb-boost-toggle]');
  const boostBox = q<HTMLElement>('[data-kvb-boost]');
  const newClients = q<HTMLInputElement>('[data-kvb-new]');
  const newOut = q<HTMLElement>('[data-kvb-new-out]');
  const visit = q<HTMLInputElement>('[data-kvb-visit]');
  const visitOut = q<HTMLElement>('[data-kvb-visit-out]');
  const total = q<HTMLElement>('[data-kvb-booksy-total]');
  const detail = q<HTMLElement>('[data-kvb-booksy-detail]');
  const segments = q<HTMLElement>('[data-kvb-segments]');
  const kersivoBar = q<HTMLElement>('[data-kvb-kersivo-bar]');
  const diff = q<HTMLElement>('[data-kvb-diff]');
  const diffLabel = q<HTMLElement>('[data-kvb-diff-label]');
  const starter = q<HTMLElement>('[data-kvb-starter]');
  if (!team || !segments) return;

  const tweens = new WeakMap<HTMLElement, gsap.core.Tween>();
  const baseScale = estimateBill(BK_TEAM_MAX).booksyIncVatGbp * 1.15;
  const SOLO_INC_VAT = estimateBill(1).booksyIncVatGbp;
  const ranges = [team, newClients, visit].filter(Boolean) as HTMLInputElement[];

  const paintRange = (input: HTMLInputElement) => {
    const min = Number(input.min);
    const max = Number(input.max);
    input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
  };

  const bump = (el: HTMLElement | null, text: string) => {
    if (!el || el.textContent === text) return;
    el.textContent = text;
    if (!reduced) gsap.fromTo(el, { y: -5, color: '#ffffff' }, { y: 0, color: '', duration: 0.35, ease: 'power3.out' });
  };

  /** One segment per charge: the base, each additional user, then Boost. */
  const renderSegments = (items: { kind: string; value: number }[], scale: number) => {
    const existing = Array.from(segments.children) as HTMLElement[];
    items.forEach((item, i) => {
      let el = existing[i];
      const isNew = !el;
      if (!el) {
        el = document.createElement('span');
        segments.appendChild(el);
      }
      el.className = `kvb-seg kvb-seg--${item.kind}`;
      const width = `${(item.value / scale) * 100}%`;
      if (reduced) {
        el.style.width = width;
      } else if (isNew) {
        gsap.fromTo(el, { width: 0, autoAlpha: 0 }, { width, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.6)' });
      } else {
        gsap.to(el, { width, autoAlpha: 1, duration: 0.45, ease: 'power3.out', overwrite: true });
      }
    });
    existing.slice(items.length).forEach((el) => {
      if (reduced) {
        el.remove();
        return;
      }
      gsap.to(el, { width: 0, autoAlpha: 0, duration: 0.3, ease: 'power2.in', overwrite: true, onComplete: () => el.remove() });
    });
  };

  const update = () => {
    const bill = estimateBill(Number(team.value));
    const boostOn = Boolean(toggle?.checked);
    const boost = estimateBoost({ newClients: Number(newClients?.value ?? 0), firstVisitGbp: Number(visit?.value ?? 0) });
    const boostMonthly = boostOn ? boost.monthlyIncVatGbp : 0;
    const booksyMonthly = bill.booksyIncVatGbp + boostMonthly;
    const scale = Math.max(baseScale, booksyMonthly * 1.05);

    ranges.forEach(paintRange);
    bump(teamOut, String(bill.teamSize));
    if (newOut && newClients) bump(newOut, newClients.value);
    if (visitOut && visit) bump(visitOut, formatGbp(Number(visit.value)));

    tweenNumber(total, booksyMonthly, reduced, tweens);
    if (detail) {
      const users = `${bill.additionalUsers} extra ${bill.additionalUsers === 1 ? 'user' : 'users'}`;
      detail.textContent = `${money(bill.booksyExVatGbp)} + VAT · base + ${users}${boostOn ? ` · Boost ${money(boost.monthlyExVatGbp)} + VAT` : ''}`;
    }

    const items = [{ kind: 'base', value: SOLO_INC_VAT }];
    const perUser = bill.additionalUsers ? (bill.booksyIncVatGbp - SOLO_INC_VAT) / bill.additionalUsers : 0;
    for (let i = 0; i < bill.additionalUsers; i += 1) items.push({ kind: 'user', value: perUser });
    if (boostOn && boostMonthly > 0) items.push({ kind: 'boost', value: boostMonthly });
    renderSegments(items, scale);

    if (kersivoBar) {
      const width = `${(SAAS_MONTHLY_GBP / scale) * 100}%`;
      if (reduced) kersivoBar.style.width = width;
      else gsap.to(kersivoBar, { width, duration: 0.45, ease: 'power3.out', overwrite: true });
    }

    const yearly = (booksyMonthly - SAAS_MONTHLY_GBP) * 12;
    if (diffLabel) diffLabel.textContent = yearly >= 0 ? 'Booksy costs more over 12 months' : 'KERSIVO costs more over 12 months';
    tweenNumber(diff, Math.abs(yearly), reduced, tweens);
    if (starter) starter.hidden = !bill.starterEligible;
  };

  const onToggle = () => {
    if (!boostBox) return update();
    const opening = Boolean(toggle?.checked);
    if (reduced) {
      boostBox.hidden = !opening;
    } else if (opening) {
      boostBox.hidden = false;
      gsap.fromTo(boostBox, { height: 0, autoAlpha: 0 }, { height: 'auto', autoAlpha: 1, duration: 0.4, ease: 'power3.out' });
    } else {
      gsap.to(boostBox, { height: 0, autoAlpha: 0, duration: 0.28, ease: 'power2.in', onComplete: () => { boostBox.hidden = true; gsap.set(boostBox, { clearProps: 'height' }); } });
    }
    update();
  };

  ranges.forEach((input) => input.addEventListener('input', update));
  toggle?.addEventListener('change', onToggle);

  // First paint of the bars draws in when the section arrives, once.
  if (reduced) {
    update();
  } else {
    gsap.set(kersivoBar, { width: 0 });
    const st = ScrollTrigger.create({ trigger: section, start: 'top 70%', once: true, onEnter: update });
    disposers.push(() => st.kill());
  }

  disposers.push(() => {
    ranges.forEach((input) => input.removeEventListener('input', update));
    toggle?.removeEventListener('change', onToggle);
  });
}

/* ---------- Moment 2: the statement lights up ---------- */

function initStatement(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-kvb-statement]');
  if (!section || reduced) return;
  const words = section.querySelectorAll('[data-kvb-word]');
  const tween = gsap.fromTo(
    words,
    { opacity: 0.16 },
    {
      opacity: 1,
      ease: 'none',
      stagger: 0.1,
      scrollTrigger: { trigger: section, start: 'top 70%', end: 'bottom 55%', scrub: 0.4 },
    },
  );
  disposers.push(() => {
    tween.scrollTrigger?.kill();
    tween.kill();
  });
}

/* ---------- Feature cards: short loops ---------- */

function buildLoop(card: HTMLElement): gsap.core.Timeline | null {
  const id = card.dataset.kvbCard;
  const tl = gsap.timeline({ repeat: -1, paused: true, defaults: { ease: 'power3.out' } });

  if (id === 'domain') {
    const text = card.querySelector<HTMLElement>('.kvb-vis-domain__text');
    const page = card.querySelectorAll('.kvb-vis-domain__page > *');
    if (!text) return null;
    const full = text.textContent ?? '';
    const typing = { n: 0 };
    tl.set(typing, { n: 0 })
      .set(page, { autoAlpha: 0, y: 8 })
      .to(typing, { n: full.length, duration: 0.9, ease: 'none', onUpdate: () => { text.textContent = full.slice(0, Math.round(typing.n)); } })
      .to(page, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, '+=0.1')
      .to({}, { duration: 1.3 })
      .to(page, { autoAlpha: 0, duration: 0.25 });
  } else if (id === 'deposit') {
    const btn = card.querySelector('.kvb-vis-deposit__btn');
    const label = card.querySelector('.kvb-vis-deposit__label');
    const done = card.querySelector('.kvb-vis-deposit__done');
    tl.set(btn, { className: 'kvb-vis-deposit__btn' })
      .set(label, { autoAlpha: 1, y: 0 })
      .set(done, { autoAlpha: 0, y: 10 })
      .to(btn, { scale: 0.95, duration: 0.12, ease: 'power2.in' }, 0.8)
      .to(btn, { scale: 1, duration: 0.3 })
      .set(btn, { className: 'kvb-vis-deposit__btn is-done' }, '<')
      .to(label, { autoAlpha: 0, y: -10, duration: 0.2 }, '<')
      .to(done, { autoAlpha: 1, y: 0, duration: 0.35 }, '<0.05')
      .to({}, { duration: 1.4 });
  } else if (id === 'retail') {
    const item = card.querySelector('.kvb-vis-retail__item');
    const status = card.querySelector('.kvb-vis-retail__status');
    tl.set(item, { autoAlpha: 0, x: -14 })
      .set(status, { autoAlpha: 0, y: 8, className: 'kvb-vis-retail__status' })
      .to(item, { autoAlpha: 1, x: 0, duration: 0.5 }, 0.2)
      .to(status, { autoAlpha: 1, y: 0, duration: 0.4 }, '+=0.3')
      .set(status, { className: 'kvb-vis-retail__status is-ready' }, '+=0.35')
      .to({}, { duration: 1.3 })
      .to([item, status], { autoAlpha: 0, duration: 0.25 });
  } else if (id === 'dashboard') {
    const bars = card.querySelectorAll('.kvb-vis-dash > span');
    tl.set(bars, { scaleY: 0.08 })
      .to(bars, { scaleY: 1, duration: 0.7, stagger: 0.07, ease: 'back.out(1.4)' }, 0.15)
      .to({}, { duration: 1.4 })
      .to(bars, { scaleY: 0.08, duration: 0.35, stagger: 0.03, ease: 'power2.in' });
  } else {
    return null;
  }
  return tl;
}

function initFeatures(root: HTMLElement, reduced: boolean, disposers: Cleanup[]) {
  const section = root.querySelector<HTMLElement>('[data-kvb-features]');
  if (!section) return;
  const pauseBtn = section.querySelector<HTMLButtonElement>('[data-kvb-pause]');
  if (reduced) {
    if (pauseBtn) pauseBtn.hidden = true;
    return;
  }
  const cards = Array.from(section.querySelectorAll<HTMLElement>('[data-kvb-card]'));
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
    if (paused) return;
    loops.get(event.currentTarget as HTMLElement)?.restart();
  };
  cards.forEach((card) => card.addEventListener('pointerenter', onEnter));

  const onPause = () => {
    paused = !paused;
    pauseBtn?.setAttribute('aria-pressed', String(paused));
    const label = pauseBtn?.querySelector('[data-kvb-pause-label]');
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

export function initKersivoVsBooksy(root: HTMLElement): Cleanup {
  const reduced = prefersReduced();
  const disposers: Cleanup[] = [];

  initHero(root, reduced, disposers);
  initChapters(root, reduced, disposers);
  initBill(root, reduced, disposers);
  initStatement(root, reduced, disposers);
  initFeatures(root, reduced, disposers);

  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(refresh).catch(() => {});
  window.addEventListener('load', refresh, { once: true });

  return () => {
    window.removeEventListener('load', refresh);
    disposers.reverse().forEach((dispose) => dispose());
    document.documentElement.classList.remove('kvb-js');
    delete root.dataset.kvbBound;
  };
}
