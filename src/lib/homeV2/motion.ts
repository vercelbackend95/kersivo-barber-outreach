import type { WipeController } from '@/lib/homeV2/wipe';

const MOTION_OK = '(prefers-reduced-motion: no-preference)';
const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const DESKTOP = '(min-width: 64rem)';

type Gsap = typeof import('gsap').gsap;
type ScrollTriggerStatic = typeof import('gsap/ScrollTrigger').ScrollTrigger;
type Cleanup = (() => void) | void;

/**
 * Scroll and signature motion for /home-v2. GSAP loads after first paint. With reduced motion
 * nothing here runs and every section keeps its static, fully visible state.
 */
export function initHomeV2Motion(root: Document, wipe: WipeController | null): () => void {
  let disposed = false;
  let revert: (() => void) | null = null;
  const offs: Array<() => void> = [];

  offs.push(bindSpotlight(root));
  if (!window.matchMedia(MOTION_OK).matches) return () => offs.forEach((off) => off());

  void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ gsap }, { ScrollTrigger }]) => {
    if (disposed) return;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      const cleanups: Cleanup[] = [];
      if (wipe) sweepWipe(gsap, wipe);
      cleanups.push(bindStagePan(gsap, root));
      cleanups.push(bindTicket(gsap, ScrollTrigger, root));
      bindHeadings(gsap, ScrollTrigger, root);
      bindLedger(gsap, ScrollTrigger, root);
      cleanups.push(bindLedgerTicks(root));
      cleanups.push(bindPrice(gsap, ScrollTrigger, root));
      cleanups.push(bindRail(gsap, ScrollTrigger, root));
      cleanups.push(bindFinal(gsap, ScrollTrigger, root));
      return () => cleanups.forEach((fn) => fn && fn());
    });

    mm.add(`${MOTION_OK} and ${DESKTOP}`, () => bindStepsPinned(gsap, ScrollTrigger, root));
    mm.add(`${MOTION_OK} and (max-width: 63.99rem)`, () => bindStepsStacked(gsap, ScrollTrigger, root));
    mm.add(`${MOTION_OK} and ${FINE_POINTER}`, () => bindMagnetic(gsap, root));

    // Demo widgets hydrate late and change heights; keep trigger positions honest.
    const main = root.querySelector<HTMLElement>('.hv2');
    let timer = 0;
    let lastHeight = main?.offsetHeight ?? 0;
    const observer = main
      ? new ResizeObserver(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            const height = main.offsetHeight;
            if (Math.abs(height - lastHeight) < 4) return;
            lastHeight = height;
            ScrollTrigger.refresh();
          }, 250);
        })
      : null;
    if (main && observer) observer.observe(main);
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad, { once: true });

    revert = () => {
      observer?.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener('load', onLoad);
      mm.revert();
    };
  });

  return () => {
    disposed = true;
    revert?.();
    revert = null;
    offs.forEach((off) => off());
  };
}

/** Runs `play` once when `el` reaches the start line, or straight away if the page already scrolled past it. */
function once(ScrollTrigger: ScrollTriggerStatic, el: Element, play: () => void, start = 'top 85%') {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    play();
  };
  const trigger = ScrollTrigger.create({ trigger: el, start, once: true, onEnter: run });
  if (trigger.scroll() >= trigger.start) {
    run();
    trigger.kill();
  }
}

/** One automatic back-and-forth on load, so the grip reads as draggable. Any visitor input stops it. */
function sweepWipe(gsap: Gsap, wipe: WipeController) {
  if (wipe.touched()) return;
  const rest = wipe.rest();
  const state = { value: wipe.get() };
  const timeline = gsap.timeline({
    delay: 1.2,
    onUpdate: () => {
      if (wipe.touched()) {
        timeline.kill();
        return;
      }
      wipe.set(state.value);
    },
  });
  timeline
    .to(state, { value: Math.max(wipe.min(), rest - 24), duration: 0.9, ease: 'power2.inOut' })
    .to(state, { value: rest + 22, duration: 1.1, ease: 'power3.inOut' })
    .to(state, { value: rest, duration: 0.85, ease: 'power2.out' });
}

/** Scrolling out of the hero scrolls both pages inside the stage: the shop site down to its booking slots, the marketplace to its app prompt. */
function bindStagePan(gsap: Gsap, root: Document) {
  const stage = root.querySelector<HTMLElement>('[data-hv2-wipe]');
  const page = root.querySelector<HTMLElement>('[data-hv2-cs-page]');
  const market = root.querySelector<HTMLElement>('[data-hv2-mk-scroll]');
  const sheet = root.querySelector<HTMLElement>('[data-hv2-mk-sheet]');
  if (!stage || !page) return undefined;
  const travel = (el: HTMLElement | null) => () => (el?.parentElement ? Math.max(0, el.scrollHeight - el.parentElement.clientHeight + 8) : 0);
  const pageTravel = travel(page);
  const marketTravel = travel(market);

  if (sheet) gsap.set(sheet, { yPercent: 160, autoAlpha: 0 });
  const timeline = gsap.timeline({
    scrollTrigger: { trigger: stage, start: 0, end: 'bottom 20%', scrub: 0.9, invalidateOnRefresh: true },
  });
  timeline.to(page, { y: () => -pageTravel(), ease: 'none', duration: 1 }, 0);
  if (market) timeline.to(market, { y: () => -marketTravel(), ease: 'none', duration: 1 }, 0);
  if (sheet) timeline.to(sheet, { yPercent: 0, autoAlpha: 1, ease: 'back.out(1.6)', duration: 0.3 }, 0.45);
  return () => {
    gsap.set([page, market, sheet].filter(Boolean), { clearProps: 'all' });
  };
}

/** Each booking step slams its rubber stamp onto the ticket as it reaches the middle of the screen. */
function bindTicket(gsap: Gsap, ScrollTrigger: ScrollTriggerStatic, root: Document) {
  const ticket = root.querySelector<HTMLElement>('[data-hv2-ticket]');
  const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-hv2-booking-step]'));
  if (!ticket || steps.length === 0) return undefined;
  const states = Array.from(ticket.querySelectorAll<HTMLElement>('[data-hv2-ticket-state]'));
  const inks = Array.from(ticket.querySelectorAll<HTMLElement>('[data-hv2-stamp] .hv2-stamp__ink'));
  const progress = ticket.querySelector<HTMLElement>('[data-hv2-ticket-progress]');
  const shown = inks.map(() => false);
  let reached = -1;

  gsap.set(inks, { autoAlpha: 0, scale: 2.4 });
  if (progress) gsap.set(progress, { scaleX: 0 });

  const stampIn = (index: number) => {
    const ink = inks[index];
    if (!ink) return;
    gsap
      .timeline()
      .fromTo(ink, { autoAlpha: 0, scale: 2.6, y: -24 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.24, ease: 'power4.in', overwrite: true })
      .to(ticket, { keyframes: { y: [0, 5, -1.5, 0], rotation: [0, -0.7, 0.35, 0] }, duration: 0.42, ease: 'power2.out' })
      .to(ink, { opacity: 1, duration: 0.6, ease: 'power1.out' }, '<');
  };
  const stampOut = (index: number) => {
    const ink = inks[index];
    if (ink) gsap.to(ink, { autoAlpha: 0, scale: 1.25, y: -8, duration: 0.22, ease: 'power2.in', overwrite: true });
  };

  const show = (next: number) => {
    reached = next;
    states.forEach((state, index) => state.classList.toggle('is-done', index <= next));
    steps.forEach((step, index) => step.classList.toggle('is-active', index === next));
    inks.forEach((_, index) => {
      if (index <= next && !shown[index]) {
        shown[index] = true;
        stampIn(index);
      } else if (index > next && shown[index]) {
        shown[index] = false;
        stampOut(index);
      }
    });
    if (progress) gsap.to(progress, { scaleX: (next + 1) / steps.length, duration: 0.5, ease: 'power3.out' });
  };

  states.forEach((state) => state.classList.remove('is-done'));
  const triggers = steps.map((step, index) =>
    ScrollTrigger.create({
      trigger: step,
      start: 'top 62%',
      onEnter: () => show(index),
      onLeaveBack: () => show(index - 1),
    }),
  );
  const already = triggers.reduce((last, trigger, index) => (trigger.scroll() >= trigger.start ? index : last), -1);
  if (already >= 0) show(already);

  return () => {
    states.forEach((state) => state.classList.add('is-done'));
    steps.forEach((step) => step.classList.remove('is-active'));
    gsap.set([...inks, ticket, progress].filter(Boolean), { clearProps: 'all' });
    void reached;
  };
}

/** Section headings rise out of a mask; eyebrow and lead follow. */
function bindHeadings(gsap: Gsap, ScrollTrigger: ScrollTriggerStatic, root: Document) {
  const heads = Array.from(root.querySelectorAll<HTMLElement>('.hv2-section .hv2-head'));
  for (const head of heads) {
    const eyebrow = head.querySelector('.hv2-eyebrow');
    const title = head.querySelector('.hv2-h2');
    const rest = Array.from(head.children).filter((child) => child !== eyebrow && child !== title && !child.hasAttribute('data-hv2-glyph'));
    if (eyebrow) gsap.set(eyebrow, { autoAlpha: 0, x: -14 });
    if (title) gsap.set(title, { clipPath: 'inset(100% 0% 0% 0%)', y: 48 });
    if (rest.length) gsap.set(rest, { autoAlpha: 0, y: 18 });
    once(ScrollTrigger, head, () => {
      const timeline = gsap.timeline({ defaults: { ease: 'expo.out' } });
      if (eyebrow) timeline.to(eyebrow, { autoAlpha: 1, x: 0, duration: 0.7 }, 0);
      if (title) timeline.to(title, { clipPath: 'inset(-10% 0% -10% 0%)', y: 0, duration: 1.15 }, 0.05);
      if (rest.length) timeline.to(rest, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.25);
    }, 'top 86%');
  }
}

function bindLedger(gsap: Gsap, ScrollTrigger: ScrollTriggerStatic, root: Document) {
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-hv2-reveal]'));
  if (items.length === 0) return;
  gsap.set(items, { autoAlpha: 0, y: 26 });
  for (const item of items) {
    once(ScrollTrigger, item, () => gsap.to(item, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' }), 'top 90%');
  }
}

/**
 * Ledger widgets loop only while their item is on screen. Each item also lights its index and
 * draws its hairline the first time it arrives.
 */
function bindLedgerTicks(root: Document) {
  const ledger = root.querySelector<HTMLElement>('.hv2-ledger');
  if (!ledger) return undefined;
  const items = Array.from(ledger.querySelectorAll<HTMLElement>('[data-hv2-tick-host]'));
  ledger.classList.add('is-armed');
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) (entry.target as HTMLElement).classList.toggle('is-on', entry.isIntersecting);
    },
    { rootMargin: '-12% 0px -12% 0px' },
  );
  items.forEach((item) => observer.observe(item));
  return () => {
    observer.disconnect();
    ledger.classList.remove('is-armed');
    items.forEach((item) => item.classList.remove('is-on'));
  };
}

/** The price rolls in like a meter, the card catches the light, and the receipt prints every line as included. */
function bindPrice(gsap: Gsap, ScrollTrigger: ScrollTriggerStatic, root: Document) {
  const plan = root.querySelector<HTMLElement>('[data-hv2-plan]');
  if (!plan) return undefined;
  const cols = Array.from(plan.querySelectorAll<HTMLElement>('[data-hv2-odo-col]'));
  const per = plan.querySelector<HTMLElement>('[data-hv2-per]');
  const glow = plan.querySelector<HTMLElement>('[data-hv2-glow]');
  const sheen = plan.querySelector<HTMLElement>('[data-hv2-sheen]');
  const receipt = plan.querySelector<HTMLElement>('[data-hv2-receipt]');
  const lines = receipt ? Array.from(receipt.querySelectorAll<HTMLElement>('[data-hv2-receipt-line]')) : [];
  const included = receipt ? Array.from(receipt.querySelectorAll<HTMLElement>('li b')) : [];

  const landing = (digit: number) => -((digit + 10) / 20) * 100;
  gsap.set(cols, { y: 0, yPercent: 0 });
  if (per) gsap.set(per, { autoAlpha: 0, x: -12 });
  if (glow) gsap.set(glow, { autoAlpha: 0, scale: 0.5 });

  const amount = plan.querySelector<HTMLElement>('.hv2-plan__amount');
  once(ScrollTrigger, amount ?? plan, () => {
    const timeline = gsap.timeline();
    cols.forEach((col, index) => {
      timeline.to(col, { yPercent: landing(Number(col.dataset.digit)), duration: 1.5 + index * 0.45, ease: 'expo.out' }, index * 0.08);
    });
    const land = 1.25 + (cols.length - 1) * 0.45;
    if (glow) timeline.to(glow, { autoAlpha: 1, scale: 1.25, duration: 0.5, ease: 'power2.out' }, land - 0.3).to(glow, { scale: 1, duration: 1.2, ease: 'elastic.out(1, 0.5)' });
    if (per) timeline.to(per, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'expo.out' }, land - 0.2);
    if (sheen) timeline.fromTo(sheen, { xPercent: -120 }, { xPercent: 120, duration: 1.3, ease: 'power2.inOut' }, land - 0.35);
  }, 'top 80%');

  if (receipt && lines.length) {
    gsap.set(receipt, { clipPath: 'inset(0% 0% 100% 0%)' });
    gsap.set(lines, { autoAlpha: 0, y: 8 });
    gsap.set(included, { autoAlpha: 0, scale: 0.6 });
    once(ScrollTrigger, receipt, () => {
      gsap
        .timeline()
        .to(receipt, { clipPath: 'inset(0% 0% -4% 0%)', duration: 1.1, ease: 'power2.inOut' })
        .to(lines, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.09, ease: 'power2.out' }, 0.15)
        .to(included, { autoAlpha: 1, scale: 1, duration: 0.4, stagger: 0.09, ease: 'back.out(3)' }, 0.3);
    }, 'top 82%');
  }

  // Team-size comparison follows the scroll: the shop grows from one barber to ten while the card
  // passes through the screen, and the KERSIVO line stays put. Once the visitor uses the slider, it is theirs.
  const compare = root.querySelector<HTMLElement>('[data-hv2-compare]');
  const range = compare?.querySelector<HTMLInputElement>('[data-hv2-compare-range]');
  let touched = false;
  let grow: ReturnType<ScrollTriggerStatic['create']> | null = null;
  const touch = () => {
    touched = true;
    grow?.kill();
    grow = null;
  };
  if (compare && range) {
    range.addEventListener('pointerdown', touch);
    range.addEventListener('keydown', touch);
    const min = Number(range.min) || 1;
    const max = Number(range.max) || 10;
    let last = Number(range.value);
    const follow = (progress: number) => {
      if (touched) return;
      const value = Math.round(min + progress * (max - min));
      if (value === last) return;
      last = value;
      range.value = String(value);
      range.dispatchEvent(new Event('input', { bubbles: true }));
    };
    grow = ScrollTrigger.create({
      trigger: compare,
      start: 'top 80%',
      end: 'bottom 40%',
      onUpdate: (self) => follow(self.progress),
      onRefresh: (self) => follow(self.progress),
    });
    follow(grow.progress);
  }

  return () => {
    grow?.kill();
    range?.removeEventListener('pointerdown', touch);
    range?.removeEventListener('keydown', touch);
    gsap.set([...cols, per, glow, sheen, receipt, ...lines, ...included].filter(Boolean), { clearProps: 'all' });
  };
}

type StepVisual = (el: HTMLElement) => void;

function stepVisuals(gsap: Gsap): StepVisual {
  return (card) => {
    const vis = card.querySelector<HTMLElement>('.hv2-vis');
    if (!vis || vis.dataset.played) return;
    vis.dataset.played = 'true';
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
    const typed = Array.from(vis.querySelectorAll<HTMLElement>('.hv2-vis__type'));
    typed.forEach((node, index) => {
      const text = node.dataset.text ?? node.textContent ?? '';
      node.dataset.text = text;
      const state = { n: 0 };
      node.textContent = '';
      timeline.to(state, {
        n: text.length,
        duration: text.length * 0.035,
        ease: 'none',
        onStart: () => node.style.setProperty('border-right-color', 'var(--color-brand)'),
        onUpdate: () => {
          node.textContent = text.slice(0, Math.round(state.n));
        },
        onComplete: () => node.style.removeProperty('border-right-color'),
      }, index === 0 ? 0.15 : '>0.1');
    });
    const fields = vis.querySelectorAll('.hv2-vis__field, .hv2-vis__card-row i');
    if (fields.length && !typed.length) timeline.from(fields, { autoAlpha: 0, y: 10, stagger: 0.08, duration: 0.5 }, 0.1);
    const send = vis.querySelector('.hv2-vis__send');
    if (send) timeline.to(send, { scale: 0.9, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' }, '>0.1');
    const blocks = vis.querySelectorAll('.hv2-vis__block');
    if (blocks.length) timeline.from(blocks, { autoAlpha: 0, y: 18, scale: 0.92, stagger: 0.12, duration: 0.6, ease: 'back.out(1.6)' }, 0.1);
    const note = vis.querySelector('.hv2-vis__note');
    if (note) timeline.from(note, { autoAlpha: 0, scale: 0.4, transformOrigin: '0% 100%', duration: 0.5, ease: 'back.out(2.2)' }, 0.2);
    const check = vis.querySelector('.hv2-vis__check');
    if (check) timeline.from(check, { scale: 0, rotation: -90, duration: 0.5, ease: 'back.out(2.6)' }, '>0.15');
    const domain = vis.querySelector('.hv2-vis__domain');
    if (domain) timeline.from(domain, { autoAlpha: 0, x: -20, duration: 0.6 }, 0.1);
    const status = vis.querySelector('.hv2-vis__status');
    if (status) timeline.from(status, { autoAlpha: 0, y: 24, duration: 0.7, ease: 'expo.out' }, 0.3);
  };
}

/** Desktop: the steps pin and travel sideways while a progress line fills and each node lights. */
function bindStepsPinned(gsap: Gsap, ScrollTrigger: ScrollTriggerStatic, root: Document) {
  const section = root.querySelector<HTMLElement>('[data-hv2-steps]');
  const pin = section?.querySelector<HTMLElement>('[data-hv2-steps-pin]');
  const track = section?.querySelector<HTMLElement>('[data-hv2-steps-track]');
  if (!section || !pin || !track) return undefined;
  const items = Array.from(track.querySelectorAll<HTMLElement>('[data-hv2-step]'));
  const nodes = Array.from(section.querySelectorAll<HTMLElement>('[data-hv2-steps-node]'));
  const play = stepVisuals(gsap);

  section.classList.add('is-pinned');
  const distance = () => Math.max(0, track.scrollWidth - pin.clientWidth);
  const light = (progress: number) => {
    section.style.setProperty('--steps-p', progress.toFixed(4));
    const last = items.length - 1;
    items.forEach((item, index) => {
      const lit = progress >= index / Math.max(1, last) - 0.04;
      item.classList.toggle('is-lit', lit);
      nodes[index]?.classList.toggle('is-lit', lit);
      if (lit) play(item);
    });
  };

  // The first card is already on stage; the rest wait dimmed until the journey reaches them.
  gsap.set(items.slice(1), { autoAlpha: 0.45, scale: 0.95 });
  const timeline = gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${Math.round(distance() * 1.15 + window.innerHeight * 0.35)}`,
      pin: true,
      scrub: 0.8,
      invalidateOnRefresh: true,
      anticipatePin: 1,
      onUpdate: (self) => light(self.progress),
    },
  });
  timeline.to(track, { x: () => -distance(), ease: 'none', duration: 1 }, 0);
  items.slice(1).forEach((item, index) => {
    const at = (index + 1) / Math.max(1, items.length - 1);
    timeline.to(item, { autoAlpha: 1, scale: 1, duration: 0.16, ease: 'power2.out' }, Math.max(0, at - 0.18));
  });
  light(0);

  return () => {
    section.classList.remove('is-pinned');
    section.style.removeProperty('--steps-p');
    items.forEach((item) => item.classList.remove('is-lit'));
    nodes.forEach((node) => node.classList.remove('is-lit'));
    gsap.set([track, ...items], { clearProps: 'all' });
  };
}

/** Phones and tablets: a timeline line draws with the scroll and each card lights as it arrives. */
function bindStepsStacked(gsap: Gsap, ScrollTrigger: ScrollTriggerStatic, root: Document) {
  const section = root.querySelector<HTMLElement>('[data-hv2-steps]');
  const track = section?.querySelector<HTMLElement>('[data-hv2-steps-track]');
  if (!section || !track) return undefined;
  const items = Array.from(track.querySelectorAll<HTMLElement>('[data-hv2-step]'));
  const play = stepVisuals(gsap);

  const line = ScrollTrigger.create({
    trigger: track,
    start: 'top 70%',
    end: 'bottom 70%',
    scrub: 0.5,
    onUpdate: (self) => section.style.setProperty('--steps-p', self.progress.toFixed(4)),
  });
  const triggers = items.map((item) => {
    const card = item.querySelector('.hv2-steps__card');
    if (card) gsap.set(card, { autoAlpha: 0, x: 28 });
    return ScrollTrigger.create({
      trigger: item,
      start: 'top 72%',
      onEnter: () => {
        item.classList.add('is-lit');
        if (card) gsap.to(card, { autoAlpha: 1, x: 0, duration: 0.8, ease: 'expo.out', overwrite: true });
        play(item);
      },
      onLeaveBack: () => item.classList.remove('is-lit'),
    });
  });
  triggers.forEach((trigger, index) => {
    if (trigger.scroll() >= trigger.start) {
      items[index].classList.add('is-lit');
      const card = items[index].querySelector('.hv2-steps__card');
      if (card) gsap.set(card, { autoAlpha: 1, x: 0 });
    }
  });

  return () => {
    line.kill();
    section.style.removeProperty('--steps-p');
    items.forEach((item) => {
      item.classList.remove('is-lit');
      const card = item.querySelector('.hv2-steps__card');
      if (card) gsap.set(card, { clearProps: 'all' });
    });
  };
}

/**
 * Chapter rail. One reading line sits 40% down the viewport: the chapter whose box contains it is
 * current, and the fill reaches a dot at the exact moment its chapter starts, so line and dots never
 * disagree. The current chapter's name shows briefly whenever it changes.
 */
function bindRail(gsap: Gsap, ScrollTrigger: ScrollTriggerStatic, root: Document) {
  const rail = root.querySelector<HTMLElement>('[data-hv2-rail]');
  if (!rail) return undefined;
  const fill = rail.querySelector<HTMLElement>('[data-hv2-rail-progress]');
  const links = Array.from(rail.querySelectorAll<HTMLAnchorElement>('[data-hv2-rail-link]'));
  const items = links
    .map((link) => ({ link, target: root.querySelector<HTMLElement>(link.getAttribute('href') ?? '') }))
    .filter((item): item is { link: HTMLAnchorElement; target: HTMLElement } => item.target !== null);
  if (items.length === 0) return undefined;

  // Section tops in page coordinates. Re-measured after every ScrollTrigger refresh (pins add
  // spacing) and whenever the page height changes (demo widgets hydrate, FAQ items open).
  let tops: number[] = [];
  let end = 0;
  const measure = () => {
    tops = items.map(({ target }) => target.getBoundingClientRect().top + window.scrollY);
    end = items[items.length - 1].target.getBoundingClientRect().bottom + window.scrollY;
  };

  let current = -1;
  let flashTimer = 0;
  // While a rail jump is scrolling, the rail shows the destination instead of every chapter it passes.
  let lockedTo = -1;
  let lockTimer = 0;
  const setFill = fill ? gsap.quickTo(fill, 'scaleY', { duration: 0.35, ease: 'power3.out' }) : null;

  const setCurrent = (index: number) => {
    if (index === current) return;
    current = index;
    items.forEach(({ link }, i) => {
      if (i === index) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
      link.classList.toggle('is-passed', i < index);
    });
    rail.classList.add('is-flash');
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => rail.classList.remove('is-flash'), 1600);
  };

  const update = () => {
    const line = window.scrollY + window.innerHeight * 0.4;
    let index = 0;
    for (let i = 0; i < tops.length; i++) if (line >= tops[i] - 1) index = i;
    const next = index + 1 < tops.length ? tops[index + 1] : end;
    const local = Math.min(1, Math.max(0, (line - tops[index]) / Math.max(1, next - tops[index])));
    // The fill touches a dot at the exact moment its chapter starts.
    const steps = Math.max(1, items.length - 1);
    setFill?.(index >= steps ? 1 : (index + local) / steps);
    setCurrent(lockedTo >= 0 ? lockedTo : index);
  };

  const release = () => {
    lockedTo = -1;
    window.clearTimeout(lockTimer);
    window.removeEventListener('scrollend', release);
    update();
  };

  const onClick = (event: MouseEvent) => {
    const index = items.findIndex(({ link }) => link === event.currentTarget);
    if (index < 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    measure();
    const nav = parseFloat(getComputedStyle(items[index].target).scrollMarginTop) || 0;
    const top = Math.max(0, tops[index] - nav);
    const smooth = window.matchMedia(MOTION_OK).matches;
    lockedTo = index;
    setCurrent(index);
    window.clearTimeout(lockTimer);
    window.addEventListener('scrollend', release, { once: true });
    lockTimer = window.setTimeout(release, 2500);
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    history.replaceState(history.state, '', items[index].link.getAttribute('href') ?? '');
    const target = items[index].target;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };

  links.forEach((link) => link.addEventListener('click', onClick));
  const onRefresh = () => {
    measure();
    update();
  };
  ScrollTrigger.addEventListener('refresh', onRefresh);
  const main = root.querySelector<HTMLElement>('.hv2');
  let resizeTimer = 0;
  const observer = main
    ? new ResizeObserver(() => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(onRefresh, 120);
      })
    : null;
  if (main && observer) observer.observe(main);

  measure();
  const trigger = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: update });
  update();
  rail.classList.remove('is-flash');

  return () => {
    trigger.kill();
    observer?.disconnect();
    ScrollTrigger.removeEventListener('refresh', onRefresh);
    window.removeEventListener('scrollend', release);
    window.clearTimeout(flashTimer);
    window.clearTimeout(lockTimer);
    window.clearTimeout(resizeTimer);
    links.forEach((link) => {
      link.removeEventListener('click', onClick);
      link.removeAttribute('aria-current');
      link.classList.remove('is-passed');
    });
    rail.classList.remove('is-flash');
    if (fill) gsap.set(fill, { clearProps: 'all' });
  };
}

/** The closing card opens like a curtain of light. */
function bindFinal(gsap: Gsap, ScrollTrigger: ScrollTriggerStatic, root: Document) {
  const card = root.querySelector<HTMLElement>('.hv2-final__card');
  if (!card) return undefined;
  const terms = Array.from(card.querySelectorAll<HTMLElement>('.hv2-final__terms li'));
  gsap.set(terms, { autoAlpha: 0, x: 24 });
  once(ScrollTrigger, card, () => {
    gsap.to(terms, { autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.07, ease: 'expo.out' });
  }, 'top 75%');
  return () => gsap.set(terms, { clearProps: 'all' });
}

/** Demo frames light up under a fine pointer. */
function bindSpotlight(root: Document) {
  if (!window.matchMedia(FINE_POINTER).matches) return () => {};
  const frames = Array.from(root.querySelectorAll<HTMLElement>('[data-hv2-spotlight]'));
  const move = (event: PointerEvent) => {
    const el = event.currentTarget as HTMLElement;
    const box = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${event.clientX - box.left}px`);
    el.style.setProperty('--my', `${event.clientY - box.top}px`);
  };
  frames.forEach((frame) => frame.addEventListener('pointermove', move));
  return () => frames.forEach((frame) => frame.removeEventListener('pointermove', move));
}

/** Primary buttons lean a few pixels toward a fine pointer. */
function bindMagnetic(gsap: Gsap, root: Document) {
  const buttons = Array.from(root.querySelectorAll<HTMLElement>('[data-hv2-magnetic], .hv2 .hv2-btn--primary'));
  const offs: Array<() => void> = [];
  for (const button of new Set(buttons)) {
    const x = gsap.quickTo(button, 'x', { duration: 0.35, ease: 'power3.out' });
    const y = gsap.quickTo(button, 'y', { duration: 0.35, ease: 'power3.out' });
    const move = (event: PointerEvent) => {
      const box = button.getBoundingClientRect();
      x(((event.clientX - box.left) / box.width - 0.5) * 8);
      y(((event.clientY - box.top) / box.height - 0.5) * 6);
    };
    const leave = () => {
      x(0);
      y(0);
    };
    button.addEventListener('pointermove', move);
    button.addEventListener('pointerleave', leave);
    offs.push(() => {
      button.removeEventListener('pointermove', move);
      button.removeEventListener('pointerleave', leave);
      gsap.set(button, { clearProps: 'x,y' });
    });
  }
  return () => offs.forEach((off) => off());
}
