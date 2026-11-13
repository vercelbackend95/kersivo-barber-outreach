/**
 * /barbershop-websites interactions. Everything here is progressive: the server markup is complete
 * and readable without it. three.js and GSAP load after first paint and only when reduced motion is
 * not requested.
 */
import { createFilm } from './film';

const MOTION_OK = '(prefers-reduced-motion: no-preference)';
const DESKTOP = '(min-width: 64rem)';

type Cleanup = () => void;

export function initBarbershopWebsite(root: Document): Cleanup {
  const cleanups: Cleanup[] = [];
  const add = (fn: Cleanup | null | undefined) => {
    if (fn) cleanups.push(fn);
  };

  const compare = root.querySelector<HTMLElement>('[data-bw-compare]');
  if (compare) add(bindCompare(compare));

  const anatomy = root.querySelector<HTMLElement>('[data-bw-anatomy]');
  if (anatomy) add(bindAnatomy(anatomy));

  const booking = root.querySelector<HTMLElement>('[data-bw-booking]');
  if (booking) add(bindBooking(booking));

  const presence = root.querySelector<HTMLElement>('[data-bw-presence]');
  if (presence) add(bindPresence(presence));

  const final = root.querySelector<HTMLElement>('[data-bw-final-try]');
  if (final) add(bindFinal(root, final));

  const scenes = root.querySelector<HTMLElement>('[data-bw-scenes]');
  if (scenes) add(bindScenes(root, scenes));

  add(bindMotion(root));

  return () => {
    for (const fn of cleanups.splice(0)) fn();
  };
}

/* ---------- Profile vs own website ---------- */
function bindCompare(section: HTMLElement): Cleanup {
  const radios = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-bw-view]'));
  const rows = section.querySelector<HTMLElement>('.bw-compare__rows');
  const select = (view: string, focus = false) => {
    section.dataset.view = view;
    if (rows) rows.dataset.view = view;
    for (const radio of radios) {
      const on = radio.dataset.bwView === view;
      radio.setAttribute('aria-checked', String(on));
      radio.tabIndex = on ? 0 : -1;
      if (on && focus) radio.focus();
    }
  };
  select('own');

  const onClick = (event: Event) => {
    const radio = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-bw-view]');
    if (radio?.dataset.bwView) select(radio.dataset.bwView);
  };
  const onKey = (event: KeyboardEvent) => {
    if (!(event.target as HTMLElement).closest('[data-bw-view]')) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const current = radios.findIndex((radio) => radio.getAttribute('aria-checked') === 'true');
    const next = radios[(current + 1) % radios.length];
    if (next?.dataset.bwView) select(next.dataset.bwView, true);
  };
  section.addEventListener('click', onClick);
  section.addEventListener('keydown', onKey);
  return () => {
    section.removeEventListener('click', onClick);
    section.removeEventListener('keydown', onKey);
  };
}

/* ---------- Anatomy ---------- */
function bindAnatomy(section: HTMLElement): Cleanup {
  const site = section.querySelector<HTMLElement>('[data-bw-site]');
  const now = section.querySelector<HTMLElement>('[data-bw-anatomy-now]');
  const triggers = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-bw-part-trigger]'));
  const camera = section.querySelector<HTMLElement>('[data-bw-camera]');
  const num = section.querySelector<HTMLElement>('[data-bw-anatomy-num]');
  const rail = section.querySelector<HTMLElement>('[data-bw-anatomy-rail]');
  const rig = camera ? createCameraRig(camera) : null;
  let active = '';

  const setActive = (part: string) => {
    if (!part || part === active) return;
    active = part;
    if (site) site.dataset.active = part;
    triggers.forEach((trigger, i) => {
      const on = trigger.dataset.bwPartTrigger === part;
      trigger.setAttribute('aria-pressed', String(on));
      if (!on) return;
      if (now) now.textContent = trigger.querySelector('.bw-anatomy__title')?.textContent ?? '';
      if (num) num.textContent = String(i + 1).padStart(2, '0');
      rail?.parentElement?.style.setProperty('--bw-rail', String((i + 1) / triggers.length));
    });
    rig?.focus(part);
  };
  setActive(triggers[0]?.dataset.bwPartTrigger ?? '');

  // A click pins the selection briefly so the scroll observer doesn't immediately override it.
  let pinnedUntil = 0;
  const onClick = (event: Event) => {
    const trigger = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-bw-part-trigger]');
    if (!trigger?.dataset.bwPartTrigger) return;
    pinnedUntil = performance.now() + 900;
    setActive(trigger.dataset.bwPartTrigger);
  };
  section.addEventListener('click', onClick);

  const desktop = window.matchMedia(DESKTOP);
  let observer: IntersectionObserver | null = null;
  const observe = () => {
    observer?.disconnect();
    observer = null;
    if (!desktop.matches) return;
    observer = new IntersectionObserver(
      (entries) => {
        if (performance.now() < pinnedUntil) return;
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).dataset.bwStep ?? '');
        }
      },
      { rootMargin: '-48% 0px -48% 0px' },
    );
    section.querySelectorAll('[data-bw-step]').forEach((item) => observer?.observe(item));
  };
  observe();
  desktop.addEventListener('change', observe);

  return () => {
    section.removeEventListener('click', onClick);
    desktop.removeEventListener('change', observe);
    observer?.disconnect();
    rig?.dispose();
  };
}

type CameraState = { s: number; x: number; y: number };

/**
 * A camera over the example site: it dollies in on the active part and frames it with a reticle.
 * Part boxes are measured on screen and the current transform is backed out to get their natural
 * position, so the maths stays correct mid-transition. Reduced motion keeps scale 1 (reticle only).
 */
function createCameraRig(camera: HTMLElement) {
  const site = camera.querySelector<HTMLElement>('[data-bw-site]');
  const reticle = camera.querySelector<HTMLElement>('[data-bw-reticle]');
  const motion = window.matchMedia(MOTION_OK);
  let state: CameraState = { s: 1, x: 0, y: 0 };
  let current = '';
  let phoneTimer = 0;

  const setCamera = (next: CameraState) => {
    state = next;
    camera.style.setProperty('--bw-cam-s', String(next.s));
    camera.style.setProperty('--bw-cam-x', `${next.x}px`);
    camera.style.setProperty('--bw-cam-y', `${next.y}px`);
  };

  const setReticle = (x: number, y: number, w: number, h: number) => {
    reticle?.style.setProperty('--bw-rx', `${x}px`);
    reticle?.style.setProperty('--bw-ry', `${y}px`);
    reticle?.style.setProperty('--bw-rw', `${w}px`);
    reticle?.style.setProperty('--bw-rh', `${h}px`);
  };

  const apply = () => {
    if (!site || !current) return;
    window.clearTimeout(phoneTimer);
    const cam = camera.getBoundingClientRect();
    if (cam.width === 0) return;

    if (current === 'phone') {
      // The phone view narrows the frame itself; frame the whole site once it settles.
      setCamera({ s: 1, x: 0, y: 0 });
      phoneTimer = window.setTimeout(() => {
        const frame = site.querySelector<HTMLElement>('.bw-site__frame');
        if (!frame || current !== 'phone') return;
        const r = frame.getBoundingClientRect();
        const c = camera.getBoundingClientRect();
        setReticle(r.left - c.left, r.top - c.top, r.width, r.height);
      }, 720);
      return;
    }

    const part = site.querySelector<HTMLElement>(`[data-bw-part='${current}']`);
    if (!part) return;
    const r = part.getBoundingClientRect();
    const nx = (r.left - cam.left - state.x) / state.s;
    const ny = (r.top - cam.top - state.y) / state.s;
    const nw = r.width / state.s;
    const nh = r.height / state.s;
    const fit = Math.min((cam.width * 0.62) / nw, (cam.height * 0.6) / nh);
    const zoom = motion.matches ? Math.min(1.55, Math.max(1, fit)) : 1;
    const cx = nx + nw / 2;
    const cy = ny + nh / 2;
    const x = Math.min(0, Math.max(cam.width - cam.width * zoom, cam.width / 2 - cx * zoom));
    const y = Math.min(0, Math.max(cam.height - cam.height * zoom, cam.height / 2 - cy * zoom));
    setCamera({ s: zoom, x, y });
    setReticle(nx * zoom + x, ny * zoom + y, nw * zoom, nh * zoom);
  };

  camera.classList.add('is-rigged');
  const ro = new ResizeObserver(() => apply());
  ro.observe(camera);

  return {
    focus(part: string) {
      current = part;
      apply();
    },
    dispose() {
      window.clearTimeout(phoneTimer);
      ro.disconnect();
      camera.classList.remove('is-rigged');
    },
  };
}

/* ---------- Booking walkthrough ---------- */
const STEP_MS = 3200;

function bindBooking(section: HTMLElement): Cleanup {
  const tabs = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-bw-tab]'));
  const panels = Array.from(section.querySelectorAll<HTMLElement>('[data-bw-panel]'));
  const pause = section.querySelector<HTMLButtonElement>('[data-bw-pause]');
  const pauseLabel = pause?.querySelector<HTMLElement>('.bw-booking__pause-label');
  const phone = section.querySelector<HTMLElement>('.bw-phone');
  let index = 0;
  let timer = 0;
  let tapTimer = 0;
  let playing = false;
  let finished = false;

  section.style.setProperty('--bw-step', `${STEP_MS}ms`);

  // A fingertip lands on the choice made in each step (decorative).
  const tapOn = (panel?: HTMLElement) => {
    if (!phone || !window.matchMedia(MOTION_OK).matches) return;
    window.clearTimeout(tapTimer);
    phone.classList.remove('is-tapping');
    const picked = panel?.querySelector<HTMLElement>('.is-picked');
    if (!picked) return;
    tapTimer = window.setTimeout(() => {
      const p = phone.getBoundingClientRect();
      const r = picked.getBoundingClientRect();
      if (p.width === 0) return;
      phone.style.setProperty('--bw-tap-x', `${r.left - p.left + r.width * 0.72}px`);
      phone.style.setProperty('--bw-tap-y', `${r.top - p.top + r.height / 2}px`);
      void phone.offsetWidth;
      phone.classList.add('is-tapping');
    }, 380);
  };

  const show = (next: number, focus = false) => {
    index = (next + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    });
    panels.forEach((panel, i) => {
      const on = i === index;
      panel.hidden = !on;
      panel.classList.toggle('is-active', on);
    });
    section.dataset.step = String(index);
    tapOn(panels[index]);
  };

  const stop = () => {
    window.clearTimeout(timer);
    playing = false;
    section.classList.remove('is-playing');
    pause?.setAttribute('aria-pressed', 'true');
    if (pauseLabel) pauseLabel.textContent = finished ? 'Replay the walkthrough' : 'Play the walkthrough';
  };

  const tick = () => {
    if (index >= tabs.length - 1) {
      finished = true;
      stop();
      return;
    }
    show(index + 1);
    // Restart the bar animation for the new tab.
    section.classList.remove('is-playing');
    void section.offsetWidth;
    section.classList.add('is-playing');
    timer = window.setTimeout(tick, STEP_MS);
  };

  const play = () => {
    if (finished) {
      finished = false;
      show(0);
    }
    playing = true;
    section.classList.add('is-armed', 'is-playing');
    pause?.setAttribute('aria-pressed', 'false');
    if (pauseLabel) pauseLabel.textContent = 'Pause the walkthrough';
    window.clearTimeout(timer);
    timer = window.setTimeout(tick, STEP_MS);
  };

  const onClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const tab = target.closest<HTMLButtonElement>('[data-bw-tab]');
    if (tab) {
      finished = index === tabs.length - 1;
      stop();
      show(Number(tab.dataset.bwTab));
      return;
    }
    if (target.closest('[data-bw-pause]')) {
      if (playing) stop();
      else play();
    }
  };

  const onKey = (event: KeyboardEvent) => {
    if (!(event.target as HTMLElement).closest('[data-bw-tab]')) return;
    const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (event.key in keys) {
      event.preventDefault();
      stop();
      show(index + keys[event.key], true);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      stop();
      show(event.key === 'Home' ? 0 : tabs.length - 1, true);
    }
  };

  section.addEventListener('click', onClick);
  section.addEventListener('keydown', onKey);
  show(0);

  // Autoplay once, the first time the walkthrough is properly in view, and only with motion allowed.
  let observer: IntersectionObserver | null = null;
  section.classList.add('is-armed');
  if (window.matchMedia(MOTION_OK).matches) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          play();
        }
      },
      { threshold: 0.45 },
    );
    const target = section.querySelector('.bw-booking__layout');
    if (target) observer.observe(target);
  } else {
    finished = false;
    stop();
  }

  return () => {
    window.clearTimeout(timer);
    window.clearTimeout(tapTimer);
    observer?.disconnect();
    section.removeEventListener('click', onClick);
    section.removeEventListener('keydown', onKey);
  };
}

/* ---------- Presence self-check ---------- */
function verdictFor(count: number, total: number): string {
  if (count === 0) return 'Tick the ones that are true today.';
  if (count === total) return 'That is a professional online presence. Every place clients find you leads to a booking.';
  if (count === total - 1) return 'Almost there. One gap left to close.';
  if (count >= total / 2) return 'A solid base. Close the remaining gaps so every place clients find you leads to a booking.';
  return 'There are gaps clients will notice. Start with your own website and online booking: everything else points to them.';
}

function bindPresence(section: HTMLElement): Cleanup {
  const inputs = Array.from(section.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  const count = section.querySelector<HTMLElement>('[data-bw-score-count]');
  const verdict = section.querySelector<HTMLElement>('[data-bw-score-verdict]');
  const score = section.querySelector<HTMLElement>('[data-bw-score]');
  const segments = Array.from(section.querySelectorAll<SVGElement>('[data-bw-seg]'));
  const gaps = section.querySelector<HTMLElement>('[data-bw-score-gaps]');
  const gapList = section.querySelector<HTMLElement>('[data-bw-score-gaps-list]');
  const withButton = section.querySelector<HTMLButtonElement>('[data-bw-score-with]');
  const withLabel = section.querySelector<HTMLElement>('[data-bw-score-with-label]');
  let withKersivo = false;
  let shown = 0;
  let countTimer = 0;

  // The number travels one step at a time so the change reads.
  const tweenCount = (to: number) => {
    window.clearTimeout(countTimer);
    if (!window.matchMedia(MOTION_OK).matches) {
      shown = to;
      if (count) count.textContent = String(to);
      return;
    }
    const step = () => {
      if (shown === to) return;
      shown += shown < to ? 1 : -1;
      if (count) count.textContent = String(shown);
      countTimer = window.setTimeout(step, 70);
    };
    step();
  };

  const howFor = (label: HTMLElement | null) => {
    const line = label?.querySelector<HTMLElement>('[data-bw-check-kersivo]');
    const tag = line?.querySelector('.bw-check__kersivo-k')?.textContent ?? '';
    return (line?.textContent ?? '').replace(tag, '').trim();
  };

  const update = () => {
    const ticked = inputs.filter((input) => input.checked).length;
    const total = inputs.length;
    let k = 0;
    inputs.forEach((input, i) => {
      const covered = withKersivo && !input.checked;
      input.closest<HTMLElement>('.bw-check')?.classList.toggle('is-covered', covered);
      const seg = segments[i];
      if (!seg) return;
      seg.classList.toggle('is-on', input.checked);
      seg.classList.toggle('is-kersivo', covered);
      seg.style.transitionDelay = covered ? `${(k += 1) * 90}ms` : '0ms';
    });
    tweenCount(withKersivo ? total : ticked);
    if (score) score.dataset.level = ticked === total ? 'full' : 'partial';

    if (verdict) {
      if (!withKersivo) verdict.textContent = verdictFor(ticked, total);
      else if (ticked === total) verdict.textContent = 'You already have every item. Full KERSIVO keeps it all in one place.';
      else
        verdict.textContent = `With Full KERSIVO, all ${total} are covered. The ${total - ticked} in red are the ones KERSIVO handles or helps with for you.`;
    }

    if (gaps && gapList) {
      const missing = inputs.filter((input) => !input.checked);
      gaps.hidden = missing.length === 0 || (ticked === 0 && !withKersivo);
      gapList.replaceChildren(
        ...missing.map((input, i) => {
          const label = input.closest<HTMLElement>('.bw-check');
          const li = document.createElement('li');
          li.style.animationDelay = `${i * 50}ms`;
          const title = document.createElement('strong');
          title.textContent = label?.querySelector('.bw-check__title')?.textContent ?? '';
          const how = document.createElement('span');
          how.textContent = howFor(label);
          li.append(title, how);
          return li;
        }),
      );
    }
  };

  const onWith = () => {
    withKersivo = !withKersivo;
    withButton?.setAttribute('aria-pressed', String(withKersivo));
    if (withLabel) withLabel.textContent = withKersivo ? 'Back to my shop today' : 'See it with Full KERSIVO';
    update();
  };

  section.classList.add('is-live');
  section.addEventListener('change', update);
  withButton?.addEventListener('click', onWith);
  update();
  return () => {
    window.clearTimeout(countTimer);
    section.classList.remove('is-live');
    section.removeEventListener('change', update);
    withButton?.removeEventListener('click', onWith);
  };
}

/* ---------- Final: your name in the address bar ---------- */
/** Illustrative only: turns a shop name into a .co.uk address. Nothing is checked, saved or sent. */
export function toDomain(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
  return `${slug.slice(0, 30) || 'yourshop'}.co.uk`;
}

function bindFinal(root: Document, wrap: HTMLElement): Cleanup {
  const input = wrap.querySelector<HTMLInputElement>('[data-bw-final-input]');
  const preview = wrap.querySelector<HTMLElement>('[data-bw-final-preview]');
  const big = root.querySelector<HTMLElement>('[data-bw-final-domain]');
  const outs = Array.from(wrap.querySelectorAll<HTMLElement>('[data-bw-final-out]'));
  const names = Array.from(wrap.querySelectorAll<HTMLElement>('[data-bw-final-name]'));
  const places = Array.from(wrap.querySelectorAll<HTMLElement>('.bw-final__place'));
  if (!input) return () => {};
  let flashTimer = 0;

  const onInput = () => {
    const raw = input.value.trim().slice(0, 32);
    const domain = toDomain(raw);
    if (preview) preview.textContent = domain;
    for (const out of outs) out.textContent = domain;
    names.forEach((el, i) => {
      const text = raw || 'Your shop';
      el.textContent = i === 0 ? text.toUpperCase() : text;
    });
    if (big) {
      big.dataset.bwTyped = 'true';
      big.textContent = domain;
      big.closest<HTMLElement>('.bw-final__domain')?.style.setProperty('--bw-len', String(Math.max(14, domain.length)));
    }
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
      for (const place of places) {
        place.classList.remove('is-flash');
        void place.offsetWidth;
        place.classList.add('is-flash');
      }
    }, 260);
  };
  input.addEventListener('input', onInput);
  return () => {
    window.clearTimeout(flashTimer);
    input.removeEventListener('input', onInput);
  };
}

/* ---------- Chapter index ---------- */
function bindScenes(root: Document, nav: HTMLElement): Cleanup {
  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('[data-bw-scene-link]'));
  const targets = links.map((link) => root.getElementById(link.dataset.bwSceneLink ?? ''));
  const reel = nav.querySelector<HTMLElement>('.bw-scenes__reel');
  let raf = 0;

  const update = () => {
    raf = 0;
    const mid = window.innerHeight * 0.45;
    let active = 0;
    targets.forEach((target, i) => {
      if (target && target.getBoundingClientRect().top <= mid) active = i;
    });
    links.forEach((link, i) => {
      if (i === active) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    const max = document.documentElement.scrollHeight - window.innerHeight;
    reel?.style.setProperty('--bw-progress', String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
    nav.classList.toggle('is-shown', window.scrollY > window.innerHeight * 0.4);
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  update();
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', onScroll);
  };
}

/* ---------- Offer card tilt ---------- */
function bindTilt(card: HTMLElement): Cleanup {
  if (!window.matchMedia(`${MOTION_OK} and (hover: hover) and (pointer: fine)`).matches) return () => {};
  let raf = 0;
  const onMove = (event: PointerEvent) => {
    const r = card.getBoundingClientRect();
    const px = (event.clientX - r.left) / r.width;
    const py = (event.clientY - r.top) / r.height;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      card.style.transform = `perspective(1200px) rotateX(${((0.5 - py) * 4).toFixed(2)}deg) rotateY(${((px - 0.5) * 5).toFixed(2)}deg)`;
      card.style.setProperty('--bw-gx', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--bw-gy', `${(py * 100).toFixed(1)}%`);
    });
  };
  const onLeave = () => {
    cancelAnimationFrame(raf);
    card.style.transform = '';
  };
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerleave', onLeave);
  return () => {
    cancelAnimationFrame(raf);
    card.removeEventListener('pointermove', onMove);
    card.removeEventListener('pointerleave', onLeave);
    card.style.transform = '';
  };
}

/* ---------- Motion ---------- */
function typeInto(el: HTMLElement, text: string, site: HTMLElement | null, onDone?: () => void): Cleanup {
  let i = 0;
  let timer = 0;
  el.textContent = '';
  site?.classList.add('is-typing');
  const step = () => {
    // The visitor may have typed their own name meanwhile; theirs wins.
    if (el.dataset.bwTyped) return;
    i += 1;
    el.textContent = text.slice(0, i);
    if (i < text.length) timer = window.setTimeout(step, 48 + Math.random() * 40);
    else {
      timer = window.setTimeout(() => {
        site?.classList.remove('is-typing');
        onDone?.();
      }, 900);
    }
  };
  timer = window.setTimeout(step, 350);
  return () => {
    window.clearTimeout(timer);
    if (!el.dataset.bwTyped) el.textContent = text;
    site?.classList.remove('is-typing');
  };
}

function bindMotion(root: Document): Cleanup {
  if (!window.matchMedia(MOTION_OK).matches) return () => {};
  let disposed = false;
  let revert: Cleanup | null = null;
  const offs: Cleanup[] = [];

  const film = root.querySelector<HTMLElement>('[data-bw-film]');
  if (film) offs.push(createFilm(film));

  const card = root.querySelector<HTMLElement>('[data-bw-tilt]');
  if (card) offs.push(bindTilt(card));

  // Hero: the domain types itself into the address bar; the headline underline sweeps in after.
  const heroSite = root.querySelector<HTMLElement>('.bw-hero [data-bw-site]');
  const heroUrl = heroSite?.querySelector<HTMLElement>('[data-bw-domain]');
  const mark = root.querySelector<HTMLElement>('.bw-hero__mark');
  if (mark) mark.style.backgroundSize = '0% 0.09em';
  if (heroSite && heroUrl) {
    offs.push(
      typeInto(heroUrl, heroUrl.dataset.bwDomain ?? heroUrl.textContent ?? '', heroSite, () => {
        if (mark) {
          mark.style.transition = 'background-size 900ms cubic-bezier(0.22, 1, 0.36, 1)';
          mark.style.backgroundSize = '100% 0.09em';
        }
      }),
    );
  }
  offs.push(() => {
    if (mark) mark.style.backgroundSize = '';
  });

  void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ gsap }, { ScrollTrigger }]) => {
    if (disposed) return;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      // Hero: the copy drifts up and the chips float apart as the opening shot ends.
      const heroScrub = { trigger: '.bw-hero', start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('.bw-hero__copy', { yPercent: -8, opacity: 0.4, ease: 'none', scrollTrigger: heroScrub });
      gsap.to('.bw-hero__chip--search', { y: -70, ease: 'none', scrollTrigger: { ...heroScrub } });
      gsap.to('.bw-hero__chip--booked', { y: -150, ease: 'none', scrollTrigger: { ...heroScrub } });

      // Why: each source flies in from depth, its beam draws, then the domain lights up.
      const orbit = root.querySelector<HTMLElement>('[data-bw-orbit]');
      if (orbit) {
        const paths = orbit.querySelectorAll('.bw-orbit__paths path');
        gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
        gsap
          .timeline({ scrollTrigger: { trigger: orbit, start: 'top 85%', end: 'center 55%', scrub: 0.8 } })
          .from(orbit.querySelectorAll('.bw-src'), {
            opacity: 0,
            scale: 0.82,
            filter: 'blur(8px)',
            stagger: 0.12,
            ease: 'power2.out',
            duration: 0.6,
          }, 0)
          .to(paths, { strokeDashoffset: 0, stagger: 0.1, ease: 'none', duration: 0.5 }, 0.25)
          .from(orbit.querySelector('.bw-orbit__target'), { scale: 0.8, opacity: 0.2, ease: 'back.out(1.6)', duration: 0.5 }, 0.55);
        ScrollTrigger.create({
          trigger: orbit,
          start: 'center 55%',
          onEnter: () => orbit.classList.add('is-lit'),
          onLeaveBack: () => orbit.classList.remove('is-lit'),
        });
      }

      // Split screen: two shots cut in one after the other.
      gsap.from('.bw-split__frame', {
        y: 60,
        opacity: 0,
        stagger: 0.12,
        duration: 1,
        ease: 'expo.out',
        clearProps: 'opacity,transform',
        scrollTrigger: { trigger: '.bw-split', start: 'top 85%', once: true },
      });

      // Booking: the device rises into its light.
      gsap.from('.bw-booking__device', {
        y: 80,
        opacity: 0,
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.bw-booking__layout', start: 'top 85%', once: true },
      });

      // Presence: checklist rows deal in.
      gsap.from('.bw-check', {
        x: 24,
        opacity: 0,
        stagger: 0.06,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.bw-checks', start: 'top 85%', once: true },
      });

      // Offer card lifts as it arrives.
      gsap.from('.bw-offer__card', {
        y: 48,
        rotate: -1.2,
        duration: 1,
        ease: 'expo.out',
        clearProps: 'transform',
        scrollTrigger: { trigger: '.bw-offer__layout', start: 'top 82%', once: true },
      });

      // Setup timeline: the line draws as the steps scroll past and each number lights.
      const steps = root.querySelector<HTMLElement>('[data-bw-steps]');
      if (steps) {
        const items = Array.from(steps.querySelectorAll<HTMLElement>('.bw-steps__item'));
        steps.style.setProperty('--bw-steps-p', '0');
        ScrollTrigger.create({
          trigger: steps,
          start: 'top 75%',
          end: 'bottom 60%',
          onUpdate: (self) => {
            steps.style.setProperty('--bw-steps-p', self.progress.toFixed(3));
            items.forEach((item, i) =>
              item.classList.toggle('is-on', self.progress >= i / Math.max(1, items.length - 1) - 0.02),
            );
          },
        });
      }

      // Final: the outlined domain types itself when it comes into view.
      const finalDomain = root.querySelector<HTMLElement>('[data-bw-final-domain]');
      let stopFinal: Cleanup | null = null;
      if (finalDomain) {
        const text = finalDomain.textContent ?? '';
        ScrollTrigger.create({
          trigger: finalDomain,
          start: 'top 85%',
          once: true,
          onEnter: () => {
            stopFinal = typeInto(finalDomain, text, null);
          },
        });
      }
      return () => {
        stopFinal?.();
        steps?.style.removeProperty('--bw-steps-p');
      };
    });

    // Desktop: the hero browser starts turned towards the copy and squares up as you scroll.
    mm.add(`${MOTION_OK} and ${DESKTOP}`, () => {
      gsap.fromTo(
        '.bw-site--hero',
        { rotateY: -12, rotateX: 4, scale: 0.97 },
        {
          rotateY: 0,
          rotateX: 0,
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: '.bw-hero', start: 'top top', end: 'bottom 40%', scrub: 0.8 },
        },
      );
    });

    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad, { once: true });
    revert = () => {
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
