/**
 * /barbershop-websites interactions. Everything here is progressive: the server markup is complete
 * and readable without it. GSAP loads after first paint and only when reduced motion is not requested.
 */
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
  let active = '';

  const setActive = (part: string) => {
    if (!part || part === active) return;
    active = part;
    if (site) site.dataset.active = part;
    for (const trigger of triggers) {
      const on = trigger.dataset.bwPartTrigger === part;
      trigger.setAttribute('aria-pressed', String(on));
      if (on && now) now.textContent = trigger.querySelector('.bw-anatomy__title')?.textContent ?? '';
    }
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
  };
}

/* ---------- Booking walkthrough ---------- */
const STEP_MS = 3200;

function bindBooking(section: HTMLElement): Cleanup {
  const tabs = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-bw-tab]'));
  const panels = Array.from(section.querySelectorAll<HTMLElement>('[data-bw-panel]'));
  const pause = section.querySelector<HTMLButtonElement>('[data-bw-pause]');
  const pauseLabel = pause?.querySelector<HTMLElement>('.bw-booking__pause-label');
  let index = 0;
  let timer = 0;
  let playing = false;
  let finished = false;

  section.style.setProperty('--bw-step', `${STEP_MS}ms`);

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
  if (window.matchMedia(MOTION_OK).matches) {
    section.classList.add('is-armed');
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
    section.classList.add('is-armed');
    finished = false;
    stop();
  }

  return () => {
    window.clearTimeout(timer);
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
  const kersivo = section.querySelector<HTMLElement>('[data-bw-score-kersivo]');
  const score = section.querySelector<HTMLElement>('[data-bw-score]');
  const segments = Array.from(section.querySelectorAll<HTMLElement>('.bw-score__bar i'));

  const update = () => {
    const ticked = inputs.filter((input) => input.checked).length;
    const kersivoGap = inputs.some((input) => !input.checked && input.closest('[data-kersivo="true"]'));
    if (count) count.textContent = String(ticked);
    if (verdict) verdict.textContent = verdictFor(ticked, inputs.length);
    if (kersivo) kersivo.hidden = !(ticked > 0 && kersivoGap);
    if (score) score.dataset.level = ticked === inputs.length ? 'full' : 'partial';
    segments.forEach((segment, i) => segment.classList.toggle('is-on', i < ticked));
  };
  section.addEventListener('change', update);
  update();
  return () => section.removeEventListener('change', update);
}

/* ---------- Motion ---------- */
function typeInto(el: HTMLElement, text: string, site: HTMLElement | null, onDone?: () => void): Cleanup {
  let i = 0;
  let timer = 0;
  el.textContent = '';
  site?.classList.add('is-typing');
  const step = () => {
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
    el.textContent = text;
    site?.classList.remove('is-typing');
  };
}

function bindMotion(root: Document): Cleanup {
  if (!window.matchMedia(MOTION_OK).matches) return () => {};
  let disposed = false;
  let revert: Cleanup | null = null;
  const offs: Cleanup[] = [];

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
      // Sources: chips slide toward the domain and the lines draw as the section scrolls in.
      const sources = root.querySelector('.bw-sources');
      if (sources) {
        gsap.set('.bw-sources__lines path', { strokeDashoffset: 1 });
        const tl = gsap.timeline({
          scrollTrigger: { trigger: sources, start: 'top 80%', end: 'center 50%', scrub: 0.6 },
        });
        tl.from('.bw-sources__item', { x: -18, opacity: 0.25, stagger: 0.08, ease: 'none' }, 0)
          .to('.bw-sources__lines path', { strokeDashoffset: 0, stagger: 0.06, ease: 'none' }, 0.1)
          .from('.bw-sources__target', { scale: 0.94, opacity: 0.4, ease: 'none' }, 0.35);
      }

      // Offer card lifts as it arrives.
      gsap.from('.bw-offer__card', {
        y: 48,
        rotate: -1.2,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.bw-offer__layout', start: 'top 82%', once: true },
      });

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
      return () => stopFinal?.();
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
