/**
 * /barbershop-website-design as a short film about design, scene by scene, with GSAP + ScrollTrigger.
 *
 * Every control is a native button, range, radio or checkbox and every state is also reachable without
 * this script; this adds the motion and the live states. With prefers-reduced-motion nothing pins,
 * nothing autoplays and nothing is hidden: states switch instantly.
 * Returns a cleanup for Astro view transitions (astro:before-swap).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type Cleanup = () => void;
type On = (el: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions) => void;
type Rect = { x: number; y: number; w: number; h: number };
type Shot = { id: string; scroll: number; rect: Rect; fixed?: boolean; layer: string };

/** The real Heritage Grooming site shows its floating Book bar once the page has scrolled past this. */
const BOOK_BAR_AFTER = 600;
/** How long the inspector holds each part of the page before moving on. */
const DWELL = 4.6;

const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function pressGroup(buttons: HTMLElement[], active: HTMLElement | undefined) {
  for (const button of buttons) button.setAttribute('aria-pressed', button === active ? 'true' : 'false');
}

function readJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/* ---------- Hero: the inspector ---------- */

function initInspector(root: HTMLElement, on: On, reduced: boolean) {
  const shots = readJson<Shot[]>(root.dataset.shots, []);
  const page = root.querySelector<HTMLElement>('[data-wd-hpage]');
  const reticle = root.querySelector<HTMLElement>('[data-wd-reticle]');
  const scan = root.querySelector<HTMLElement>('[data-wd-scan]');
  const layerLabel = root.querySelector<HTMLElement>('[data-wd-reticle-layer]');
  const sizeLabel = root.querySelector<HTMLElement>('[data-wd-reticle-size]');
  const pause = root.querySelector<HTMLButtonElement>('[data-wd-inspector-pause]');
  const pauseLabel = root.querySelector<HTMLElement>('[data-wd-inspector-pause-label]');
  const items = [...root.querySelectorAll<HTMLButtonElement>('[data-point]')];
  const bars = items.map((item) => item.querySelector<HTMLElement>('[data-wd-progress]'));
  if (!page || !reticle || shots.length === 0 || items.length === 0) return;

  const viewportY = (shot: Shot) => (shot.fixed ? shot.rect.y : shot.rect.y - shot.scroll);
  const first = shots[0];
  const state = { scroll: first.scroll, x: first.rect.x, y: viewportY(first), w: first.rect.w, h: first.rect.h };

  const paint = () => {
    page.style.setProperty('--scroll', state.scroll.toFixed(1));
    page.dataset.bar = state.scroll > BOOK_BAR_AFTER ? 'on' : 'off';
    reticle.style.setProperty('--rx', state.x.toFixed(1));
    reticle.style.setProperty('--ry', state.y.toFixed(1));
    reticle.style.setProperty('--rw', state.w.toFixed(1));
    reticle.style.setProperty('--rh', state.h.toFixed(1));
  };

  const placeTag = (shot: Shot) => {
    const y = viewportY(shot);
    reticle.dataset.tag = shot.rect.h > 600 ? 'inside' : y < 34 ? 'below' : 'above';
  };

  let index = 0;
  let move: gsap.core.Tween | null = null;
  let progress: gsap.core.Tween | null = null;
  let autoplay = !reduced;
  let visible = false;

  const resetBars = () => bars.forEach((bar) => bar && gsap.set(bar, { scaleX: 0 }));

  const runProgress = () => {
    progress?.kill();
    progress = null;
    if (!autoplay) return;
    const bar = bars[index];
    if (!bar) return;
    progress = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: DWELL, ease: 'none', onComplete: () => go((index + 1) % shots.length) });
    if (!visible) progress.pause();
  };

  const go = (next: number, instant = reduced) => {
    const shot = shots.find((item) => item.id === items[next]?.dataset.point) ?? shots[next];
    if (!shot) return;
    index = next;
    root.dataset.active = shot.id;
    pressGroup(items, items[next]);
    resetBars();
    placeTag(shot);
    if (layerLabel) layerLabel.textContent = shot.layer;
    if (sizeLabel) sizeLabel.textContent = `${shot.rect.w} × ${shot.rect.h}`;

    move?.kill();
    const target = { scroll: shot.scroll, x: shot.rect.x, y: viewportY(shot), w: shot.rect.w, h: shot.rect.h };
    if (instant) {
      Object.assign(state, target);
      paint();
    } else {
      move = gsap.to(state, { ...target, duration: 1.15, ease: 'power3.inOut', onUpdate: paint });
      gsap.fromTo(reticle.querySelector('.wd-reticle__tag'), { y: 4, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, delay: 0.75, ease: 'power2.out' });
    }
    runProgress();
  };

  const setAutoplay = (value: boolean) => {
    autoplay = value;
    if (pause) {
      pause.setAttribute('aria-pressed', value ? 'false' : 'true');
      if (pauseLabel) pauseLabel.textContent = value ? 'Pause' : 'Play';
    }
    if (value) runProgress();
    else {
      progress?.kill();
      progress = null;
      resetBars();
    }
  };

  items.forEach((item, itemIndex) => {
    on(item, 'click', () => {
      setAutoplay(false);
      go(itemIndex);
    });
    on(item, 'pointerenter', (event) => {
      if ((event as PointerEvent).pointerType !== 'mouse' || itemIndex === index) return;
      setAutoplay(false);
      go(itemIndex);
    });
    on(item, 'focus', () => {
      if (itemIndex === index) return;
      setAutoplay(false);
      go(itemIndex);
    });
  });

  paint();
  placeTag(first);
  if (reduced) return;

  if (pause) {
    pause.hidden = false;
    on(pause, 'click', () => {
      const next = !autoplay;
      setAutoplay(next);
      if (next) go((index + 1) % shots.length);
    });
  }

  ScrollTrigger.create({
    trigger: root,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      visible = self.isActive;
      if (!progress) return;
      if (visible) progress.resume();
      else progress.pause();
    },
  });

  // Entrance: the design is scanned top to bottom, then the selection box lands on the first part.
  const glass = root.querySelector<HTMLElement>('.wd-device__viewport');
  const height = glass?.clientHeight ?? 600;
  const intro = gsap.timeline({ delay: 0.55 });
  if (scan) {
    intro
      .fromTo(scan, { y: 0, opacity: 0 }, { opacity: 1, duration: 0.15 })
      .to(scan, { y: height, duration: 1.1, ease: 'power2.inOut' }, '<')
      .to(scan, { opacity: 0, duration: 0.25 }, '-=0.2');
  }
  intro
    .fromTo(reticle, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.6)' }, '-=0.35')
    .add(() => runProgress());
}

/* ---------- 01: the first-glance compare ---------- */

function initCompare(root: HTMLElement, on: On, reduced: boolean) {
  const range = root.querySelector<HTMLInputElement>('[data-wd-compare-range]');
  const questions = [...document.querySelectorAll<HTMLElement>('[data-wd-glance-questions] [data-mark-x]')];
  if (!range) return;

  const paint = (value: number) => {
    root.style.setProperty('--pos', `${value}%`);
    range.setAttribute(
      'aria-valuetext',
      value >= 85 ? 'Mostly the generic template' : value <= 15 ? 'Mostly the designed page' : `${Math.round(100 - value)}% of the designed page shown`,
    );
    for (const question of questions) question.dataset.on = Number(question.dataset.markX) > value ? 'true' : 'false';
  };

  let sweep: gsap.core.Timeline | null = null;
  const stop = () => {
    sweep?.kill();
    sweep = null;
  };
  on(range, 'input', () => {
    stop();
    paint(Number(range.value));
  });
  on(range, 'pointerdown', stop);
  on(range, 'keydown', stop);
  paint(Number(range.value));

  if (reduced) return;

  gsap.from(questions, {
    y: 28,
    opacity: 0,
    duration: 0.7,
    stagger: 0.08,
    ease: 'power3.out',
    scrollTrigger: { trigger: questions[0]?.parentElement ?? root, start: 'top 88%', once: true },
  });

  // The film: show the template, then sweep the divider across and let each answer light up in turn.
  const value = { v: Number(range.value) };
  const write = () => {
    const rounded = Math.round(value.v);
    range.value = String(rounded);
    paint(value.v);
  };
  ScrollTrigger.create({
    trigger: root,
    start: 'top 62%',
    once: true,
    onEnter: () => {
      sweep = gsap
        .timeline({ onUpdate: write })
        .to(value, { v: 96, duration: 0.9, ease: 'power2.inOut' })
        .to(value, { v: 18, duration: 2.6, ease: 'power2.inOut' }, '+=0.45');
    },
  });
}

/* ---------- 02: mobile UX ---------- */

function initMobile(root: HTMLElement, on: On, reduced: boolean, media: gsap.MatchMedia[]) {
  const pin = root.querySelector<HTMLElement>('[data-wd-mobile-pin]');
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-layer-button]')];
  const meters = buttons.map((button) => button.querySelector<HTMLElement>('[data-wd-layer-meter]'));
  const page = root.querySelector<HTMLElement>('[data-wd-mobile-page]');
  const scrolls = readJson<Record<string, number>>(root.dataset.scrolls, {});
  if (!pin || buttons.length === 0) return;

  const state = { scroll: Number(page?.style.getPropertyValue('--scroll')) || 0 };
  const paintPage = () => {
    if (!page) return;
    page.style.setProperty('--scroll', state.scroll.toFixed(1));
    page.dataset.bar = state.scroll > BOOK_BAR_AFTER ? 'on' : 'off';
  };

  let current = root.dataset.layer ?? buttons[0].dataset.layerButton ?? '';
  let pinned: ScrollTrigger | null = null;

  const setLayer = (id: string, instant = reduced) => {
    if (id === current && !instant) return;
    current = id;
    root.dataset.layer = id;
    pressGroup(buttons, buttons.find((button) => button.dataset.layerButton === id));
    const target = scrolls[id] ?? 0;
    gsap.killTweensOf(state);
    if (instant) {
      state.scroll = target;
      paintPage();
    } else {
      gsap.to(state, { scroll: target, duration: 1.1, ease: 'power3.inOut', onUpdate: paintPage });
    }
    if (!pinned) meters.forEach((meter, index) => meter && gsap.set(meter, { scaleX: buttons[index].dataset.layerButton === id ? 1 : 0 }));
  };

  buttons.forEach((button, index) => {
    on(button, 'click', () => {
      const id = button.dataset.layerButton ?? '';
      if (pinned) {
        // In the pinned film the scroll owns the layer: jump to that layer's part of the scroll.
        const top = pinned.start + ((index + 0.5) / buttons.length) * (pinned.end - pinned.start);
        window.scrollTo({ top, behavior: 'smooth' });
      }
      setLayer(id, reduced);
    });
  });

  setLayer(current, true);
  if (reduced) return;

  gsap.from(root.querySelectorAll('.wd-mobile__phone'), {
    y: 70,
    opacity: 0,
    duration: 1,
    stagger: 0.14,
    ease: 'power3.out',
    scrollTrigger: { trigger: root, start: 'top 70%', once: true },
  });

  const mm = gsap.matchMedia();
  media.push(mm);
  mm.add('(min-width: 1024px)', () => {
    root.classList.add('is-pinnable');
    pinned = ScrollTrigger.create({
      trigger: pin,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * 2.1)}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const steps = self.progress * buttons.length;
        meters.forEach((meter, index) => meter && gsap.set(meter, { scaleX: gsap.utils.clamp(0, 1, steps - index) }));
        const layer = buttons[Math.min(buttons.length - 1, Math.floor(steps))]?.dataset.layerButton;
        if (layer) setLayer(layer, false);
      },
    });
    return () => {
      pinned = null;
      root.classList.remove('is-pinnable');
      setLayer(current, true);
    };
  });
}

/* ---------- 03: brand ---------- */

function initBrand(root: HTMLElement, on: On, reduced: boolean, created: Element[]) {
  const stage = root.querySelector<HTMLElement>('[data-wd-brand-preview]');
  const canvas = root.querySelector<HTMLElement>('[data-wd-brand-canvas]');
  const layer = root.querySelector<HTMLElement>('[data-wd-brand-layer]');
  const laser = root.querySelector<HTMLElement>('[data-wd-brand-laser]');
  const palettes = [...root.querySelectorAll<HTMLInputElement>('[data-wd-palette]')];
  const types = [...root.querySelectorAll<HTMLInputElement>('[data-wd-type]')];
  if (!stage || !canvas || !layer) return;

  let wipe: gsap.core.Timeline | null = null;
  let leaving: HTMLElement | null = null;
  const finishWipe = () => {
    wipe?.kill();
    wipe = null;
    leaving?.remove();
    leaving = null;
    if (laser) gsap.set(laser, { opacity: 0 });
  };

  const apply = (palette: string, type: string) => {
    const oldPalette = stage.dataset.palette ?? '';
    const oldType = stage.dataset.type ?? '';
    if (palette === oldPalette && type === oldType) return;
    finishWipe();
    if (!reduced) {
      // The old look stays on a copy on top, and is cut away left to right behind a laser line.
      const copy = layer.cloneNode(true) as HTMLElement;
      copy.removeAttribute('data-wd-brand-layer');
      copy.classList.add('is-leaving');
      copy.dataset.palette = oldPalette;
      copy.dataset.type = oldType;
      canvas.insertBefore(copy, laser);
      leaving = copy;
      created.push(copy);
      wipe = gsap
        .timeline({ onComplete: finishWipe })
        .fromTo(copy, { clipPath: 'inset(0 0 0 0%)' }, { clipPath: 'inset(0 0 0 100%)', duration: 0.95, ease: 'power2.inOut' }, 0);
      if (laser) {
        wipe
          .fromTo(laser, { left: '0%', opacity: 1 }, { left: '100%', duration: 0.95, ease: 'power2.inOut' }, 0)
          .to(laser, { opacity: 0, duration: 0.2 }, 0.85);
      }
    }
    stage.dataset.palette = palette;
    stage.dataset.type = type;
  };

  const checked = (inputs: HTMLInputElement[]) => inputs.find((input) => input.checked)?.value ?? inputs[0]?.value ?? '';
  let showcase: gsap.core.Timeline | null = null;
  const onChange = () => {
    showcase?.kill();
    showcase = null;
    apply(checked(palettes), checked(types));
  };
  for (const input of [...palettes, ...types]) on(input, 'change', onChange);

  if (reduced) return;

  // Once, as the section arrives: the same shop in three looks, ending on the one that is ticked.
  const select = (inputs: HTMLInputElement[], value: string) => inputs.forEach((input) => (input.checked = input.value === value));
  const look = (palette: string, type: string) => () => {
    select(palettes, palette);
    select(types, type);
    apply(palette, type);
  };
  const startPalette = checked(palettes);
  const startType = checked(types);
  ScrollTrigger.create({
    trigger: stage,
    start: 'top 65%',
    once: true,
    onEnter: () => {
      showcase = gsap
        .timeline({ delay: 0.5 })
        .add(look('night', 'condensed'))
        .add(look('clean', 'sans'), '+=1.7')
        .add(look(startPalette, startType), '+=1.7');
    },
  });

  gsap.from(root.querySelectorAll('.wd-principle'), {
    y: 30,
    opacity: 0,
    duration: 0.8,
    stagger: 0.1,
    ease: 'power3.out',
    scrollTrigger: { trigger: root.querySelector('.wd-principles') ?? root, start: 'top 85%', once: true },
  });
}

/* ---------- 04: photography ---------- */

function initPhoto(root: HTMLElement, on: On, reduced: boolean) {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-shot-button]')];
  const frameNo = root.querySelector<HTMLElement>('[data-wd-frame-no]');
  buttons.forEach((button, index) => {
    on(button, 'click', () => {
      root.dataset.shot = button.dataset.shotButton ?? '';
      pressGroup(buttons, button);
      if (frameNo) frameNo.textContent = `${String(index + 1).padStart(2, '0')}A`;
    });
  });

  if (reduced) return;

  const frame = root.querySelector<HTMLElement>('.wd-lightbox__frame');
  if (frame) {
    gsap.from(frame, {
      clipPath: 'inset(12% 10% 12% 10% round 18px)',
      duration: 1.3,
      ease: 'power3.inOut',
      scrollTrigger: { trigger: frame, start: 'top 80%', once: true },
    });
    gsap.fromTo(frame, { y: 36 }, { y: -36, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  // The contact sheet: frames land, then the grease pencil marks the edit.
  const sheet = root.querySelector<HTMLElement>('.wd-sheet');
  if (sheet) {
    const frames = sheet.querySelectorAll('.wd-sheet__frame');
    const strokes = sheet.querySelectorAll('.wd-sheet__circle path, .wd-sheet__cross path');
    gsap.set(strokes, { strokeDashoffset: 1 });
    gsap
      .timeline({ scrollTrigger: { trigger: sheet, start: 'top 78%', once: true } })
      .from(frames, { y: 24, opacity: 0, duration: 0.6, stagger: 0.06, ease: 'power3.out' })
      .to(strokes, { strokeDashoffset: 0, duration: 0.45, stagger: 0.16, ease: 'power2.inOut' }, '-=0.1');
  }

  gsap.from(root.querySelectorAll('.wd-barber'), {
    y: 40,
    opacity: 0,
    duration: 0.8,
    stagger: 0.1,
    ease: 'power3.out',
    scrollTrigger: { trigger: root.querySelector('.wd-team') ?? root, start: 'top 80%', once: true },
  });
}

/* ---------- 05: self-check ---------- */

function initAudit(root: HTMLElement, on: On, reduced: boolean) {
  const boxes = [...root.querySelectorAll<HTMLInputElement>('[data-wd-audit-item]')];
  const score = root.querySelector<HTMLElement>('[data-wd-score]');
  const count = root.querySelector<HTMLElement>('[data-wd-score-count]');
  const cells = score ? [...score.querySelectorAll<HTMLElement>('.wd-score__meter i')] : [];
  const tiers = [...root.querySelectorAll<HTMLElement>('[data-min]')];
  const fixes = [...root.querySelectorAll<HTMLElement>('[data-fix]')];
  const empty = root.querySelector<HTMLElement>('[data-wd-fixes-empty]');
  if (!score || boxes.length === 0) return;

  const shown = { n: 0 };
  const update = () => {
    const ticked = new Set(boxes.filter((box) => box.checked).map((box) => box.value));
    const n = ticked.size;
    cells.forEach((cell, index) => cell.classList.toggle('is-lit', index < n));

    let level = 0;
    tiers.forEach((tier, index) => {
      if (n >= Number(tier.dataset.min)) level = index;
    });
    tiers.forEach((tier, index) => (tier.hidden = index !== level));
    score.dataset.level = String(level);
    score.style.setProperty('--p', String(n / boxes.length));

    let open = 0;
    for (const fix of fixes) {
      const done = ticked.has(fix.dataset.fix ?? '');
      fix.hidden = done;
      if (!done) open += 1;
    }
    if (empty) empty.hidden = open > 0;

    if (!count) return;
    if (reduced) {
      count.textContent = String(n);
      return;
    }
    gsap.to(shown, { n, duration: 0.45, ease: 'power2.out', onUpdate: () => (count.textContent = String(Math.round(shown.n))) });
    gsap.fromTo(count, { scale: 1.14 }, { scale: 1, duration: 0.5, ease: 'back.out(2)', transformOrigin: '0% 100%' });
  };

  for (const box of boxes) on(box, 'change', update);
  update();

  if (reduced) return;
  gsap.from(root.querySelectorAll('.wd-tool'), {
    y: 24,
    opacity: 0,
    duration: 0.7,
    stagger: 0.06,
    ease: 'power3.out',
    scrollTrigger: { trigger: root.querySelector('.wd-tools') ?? root, start: 'top 85%', once: true },
  });
}

/* ---------- 06: Full KERSIVO ---------- */

function initOffer(root: HTMLElement, reduced: boolean, media: gsap.MatchMedia[]) {
  const steps = root.querySelector<HTMLElement>('[data-wd-steps]');
  const line = root.querySelector<HTMLElement>('[data-wd-steps-line]');
  const items = steps ? [...steps.querySelectorAll<HTMLElement>('.wd-step')] : [];
  if (!steps || !line) return;

  const light = (progress: number) => {
    items.forEach((item, index) => item.classList.toggle('is-lit', progress >= (index / Math.max(1, items.length - 1)) * 0.96));
  };
  if (reduced) {
    light(1);
    return;
  }

  const mm = gsap.matchMedia();
  media.push(mm);
  mm.add({ wide: '(min-width: 768px)', narrow: '(max-width: 767px)' }, (context) => {
    const wide = Boolean(context.conditions?.wide);
    gsap.fromTo(
      line,
      wide ? { scaleX: 0, scaleY: 1 } : { scaleY: 0, scaleX: 1 },
      {
        ...(wide ? { scaleX: 1 } : { scaleY: 1 }),
        ease: 'none',
        scrollTrigger: {
          trigger: steps,
          start: 'top 78%',
          end: wide ? 'bottom 55%' : 'bottom 60%',
          scrub: 0.6,
          onUpdate: (self) => light(self.progress),
        },
      },
    );
  });

  gsap.from(root.querySelectorAll('.wd-outcome, .wd-price'), {
    y: 36,
    opacity: 0,
    duration: 0.8,
    stagger: 0.08,
    ease: 'power3.out',
    scrollTrigger: { trigger: root.querySelector('.wd-offer__grid') ?? root, start: 'top 82%', once: true },
  });
}

/* ---------- Every scene: the heading is cut in behind a laser ---------- */

function initReveals(doc: Document, created: Element[]) {
  for (const heading of doc.querySelectorAll<HTMLElement>('[data-wd-reveal]')) {
    const laser = doc.createElement('span');
    laser.className = 'wd-reveal-laser';
    laser.setAttribute('aria-hidden', 'true');
    heading.append(laser);
    created.push(laser);
    gsap
      .timeline({ scrollTrigger: { trigger: heading, start: 'top 86%', once: true } })
      .fromTo(heading, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.95, ease: 'power3.inOut' }, 0)
      .fromTo(laser, { left: '0%', opacity: 1 }, { left: '100%', duration: 0.95, ease: 'power3.inOut' }, 0)
      .to(laser, { opacity: 0, duration: 0.25 }, 0.85);
  }

  gsap.utils.toArray<HTMLElement>('main.wd .wd-section .wd-lede, .wd-answer__card, .wd-chapters').forEach((element) => {
    gsap.from(element, {
      y: 24,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: element, start: 'top 90%', once: true },
    });
  });
}

export function initWebsiteDesign(doc: Document): Cleanup {
  const reduced = prefersReduced();
  const listeners: Array<[EventTarget, string, EventListener, AddEventListenerOptions | undefined]> = [];
  const created: Element[] = [];
  const media: gsap.MatchMedia[] = [];
  const on: On = (el, type, fn, options) => {
    el.addEventListener(type, fn, options);
    listeners.push([el, type, fn, options]);
  };

  const ctx = gsap.context(() => {
    const inspector = doc.querySelector<HTMLElement>('[data-wd-inspector]');
    if (inspector) initInspector(inspector, on, reduced);
    const compare = doc.querySelector<HTMLElement>('[data-wd-compare]');
    if (compare) initCompare(compare, on, reduced);
    const mobile = doc.querySelector<HTMLElement>('[data-wd-mobile]');
    if (mobile) initMobile(mobile, on, reduced, media);
    const brand = doc.querySelector<HTMLElement>('[data-wd-brand]');
    if (brand) initBrand(brand, on, reduced, created);
    const photo = doc.querySelector<HTMLElement>('[data-wd-photo]');
    if (photo) initPhoto(photo, on, reduced);
    const audit = doc.querySelector<HTMLElement>('[data-wd-audit]');
    if (audit) initAudit(audit, on, reduced);
    const offer = doc.querySelector<HTMLElement>('[data-wd-offer]');
    if (offer) initOffer(offer, reduced, media);
    if (!reduced) initReveals(doc, created);
  });

  // Images above the pinned section change its height once they load.
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener('load', refresh, { once: true });

  return () => {
    window.removeEventListener('load', refresh);
    for (const [el, type, fn, options] of listeners) el.removeEventListener(type, fn, options);
    for (const mm of media) mm.revert();
    ctx.revert();
    for (const element of created) element.remove();
  };
}
