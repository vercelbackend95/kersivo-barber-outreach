/**
 * The /barbershop-reports dashboard film: the real KERSIVO owner dashboard (the Heritage Grooming
 * demo, `?embed=hero`) in a same-origin iframe, directed from this page.
 *
 * Each chapter is a short script of real interactions: a cursor travels to the sidebar and clicks
 * it, presses the Reports range buttons, filters the day, types into the Team and Clients search
 * boxes, while a ring and a short tag mark what the click just changed. Everything happens in the
 * live dashboard (its own charts animate, its own counts update); writes are blocked by the demo.
 *
 * The iframe renders at a fixed desktop size (1180 × 720) and the canvas is scaled to the stage.
 * On a narrow stage the camera follows the action instead of showing the whole screen.
 * Scripts loop while their chapter is on and stop the moment it changes (AbortController).
 */
import { gsap } from 'gsap';

export const FILM_CANVAS = { width: 1180, height: 720 } as const;
/** Below this stage width the camera zooms in and follows the action. */
const NARROW_STAGE = 760;
/** Logical width the camera shows on a narrow stage. */
const NARROW_VIEW = 620;

export type FilmDirector = {
  /** Switch the dashboard to a chapter and play its script (looping until the next call). */
  play: (chapter: number) => void;
  /** Whether scripts may run (off-screen or paused: they stop). */
  setRunning: (running: boolean) => void;
  dispose: () => void;
};

type Ctx = {
  doc: Document;
  signal: AbortSignal;
};

class Cancelled extends Error {}

const SECTION_LABELS = ['Bookings', 'Team', 'Reports', 'Clients', 'Sales'];

/* ---------- Finding things in the dashboard ---------- */

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function byText(doc: Document, selector: string, text: string | RegExp, root: ParentNode = doc): HTMLElement | null {
  const list = Array.from(root.querySelectorAll<HTMLElement>(selector));
  return (
    list.find((el) => {
      const t = norm(el.textContent);
      return typeof text === 'string' ? t === text : text.test(t);
    }) ?? null
  );
}

const main = (doc: Document) => doc.querySelector('main') ?? doc.body;
const sidebarLink = (doc: Document, label: string) => byText(doc, '.admin-sidebar-link', label);
/** Buttons in the content area (not the sidebar). */
const contentButton = (doc: Document, text: string | RegExp) =>
  Array.from(main(doc).querySelectorAll<HTMLElement>('button, [role="button"], [role="tab"]')).find((el) => {
    if (el.closest('.admin-sidebar, nav, aside')) return false;
    const t = norm(el.textContent);
    return typeof text === 'string' ? t === text : text.test(t);
  }) ?? null;

const visible = (el: Element | null): el is HTMLElement => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** The content column the dashboard scrolls (overflow is hidden in the embed, scrollTop still works). */
function contentScroller(doc: Document): HTMLElement | null {
  const candidates = Array.from(doc.querySelectorAll<HTMLElement>('main div')).filter(
    (el) => el.scrollHeight > el.clientHeight + 40 && el.clientHeight > 400 && !el.classList.contains('admin-vtl-scroll'),
  );
  return candidates[0] ?? null;
}

export function createFilmDirector(options: {
  stage: HTMLElement;
  canvas: HTMLElement;
  frame: HTMLIFrameElement;
  fx: HTMLElement;
  reduced: boolean;
  /** Called when a chapter's script finishes a pass (the non-pinned film moves on). */
  onPass?: (chapter: number) => void;
}): FilmDirector {
  const { stage, canvas, frame, fx, reduced, onPass } = options;
  const cursor = fx.querySelector<HTMLElement>('[data-kar-cursor]');
  const ring = fx.querySelector<HTMLElement>('[data-kar-ring]');
  const tag = fx.querySelector<HTMLElement>('[data-kar-tag]');
  const tagText = tag?.querySelector<HTMLElement>('[data-kar-tag-text]') ?? tag;

  let controller: AbortController | null = null;
  let chapter = -1;
  let running = false;
  const cam = { x: 0, y: 0, s: 1 };
  let narrow = false;
  let baseScale = 1;

  /* ---------- Camera ---------- */

  const applyCam = () => {
    canvas.style.transform = `translate(${-cam.x * cam.s}px, ${-cam.y * cam.s}px) scale(${cam.s})`;
    fx.style.setProperty('--kar-inv', String(1 / cam.s));
  };

  const layout = () => {
    const w = stage.clientWidth;
    if (!w) return;
    narrow = w < NARROW_STAGE;
    baseScale = narrow ? w / NARROW_VIEW : w / FILM_CANVAS.width;
    gsap.killTweensOf(cam);
    cam.s = baseScale;
    if (!narrow) {
      cam.x = 0;
      cam.y = 0;
    } else {
      // Start on the content column, just right of the sidebar.
      cam.x = Math.min(FILM_CANVAS.width - NARROW_VIEW, 270);
      cam.y = 0;
    }
    applyCam();
  };

  /** Narrow stage: glide the camera so the element sits in view. */
  const focus = (el: HTMLElement | null, animate = true) => {
    if (!narrow || !el) return;
    const r = el.getBoundingClientRect();
    const viewW = stage.clientWidth / cam.s;
    const viewH = stage.clientHeight / cam.s;
    const x = Math.min(Math.max(0, r.left + r.width / 2 - viewW / 2), FILM_CANVAS.width - viewW);
    const y = Math.min(Math.max(0, r.top + r.height / 2 - viewH / 2), FILM_CANVAS.height - viewH);
    if (!animate || reduced) {
      cam.x = x;
      cam.y = y;
      applyCam();
      return;
    }
    gsap.to(cam, { x, y, duration: 0.8, ease: 'power3.inOut', onUpdate: applyCam, overwrite: true });
  };

  const ro = new ResizeObserver(layout);
  ro.observe(stage);
  layout();

  /* ---------- Script primitives ---------- */

  const check = (ctx: Ctx) => {
    if (ctx.signal.aborted) throw new Cancelled();
  };

  const wait = (ctx: Ctx, ms: number) =>
    new Promise<void>((resolve, reject) => {
      const id = window.setTimeout(resolve, ms);
      ctx.signal.addEventListener('abort', () => {
        window.clearTimeout(id);
        reject(new Cancelled());
      }, { once: true });
    });

  const centre = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.min(r.width / 2, 60), y: r.top + r.height / 2 };
  };

  /** Scroll the dashboard so the element is inside the 720px frame before pointing at it. */
  const reveal = async (ctx: Ctx, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    if (r.top >= 70 && r.bottom <= FILM_CANVAS.height - 30) return;
    let box: HTMLElement | null = el.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight + 20 && box.clientHeight > 200)) box = box.parentElement;
    if (!box) return;
    const target = box.scrollTop + r.top - Math.max(90, (FILM_CANVAS.height - r.height) / 2);
    await scrollTo(ctx, box, Math.max(0, Math.min(target, box.scrollHeight - box.clientHeight)), 0.7);
  };

  /** Back to the top of the section's content (between passes and chapters). */
  const resetScroll = (doc: Document) => {
    doc.querySelectorAll<HTMLElement>('main div').forEach((el) => {
      if (el.scrollTop > 0 && el.clientHeight > 300 && !el.classList.contains('admin-vtl-scroll')) gsap.to(el, { scrollTop: 0, duration: 0.6, ease: 'power2.inOut', overwrite: true });
    });
  };

  const moveCursor = async (ctx: Ctx, el: HTMLElement | null, duration = 0.75) => {
    check(ctx);
    if (!el || !cursor) return;
    await reveal(ctx, el);
    focus(el);
    const { x, y } = centre(el);
    gsap.to(cursor, { autoAlpha: 1, duration: 0.25, overwrite: 'auto' });
    await new Promise<void>((resolve) => {
      gsap.to(cursor, { x, y, duration, ease: 'power3.inOut', overwrite: 'auto', onComplete: resolve });
    });
    check(ctx);
  };

  const press = async (ctx: Ctx, el: HTMLElement | null) => {
    check(ctx);
    if (!el || !cursor) return;
    cursor.classList.remove('is-press');
    void cursor.offsetWidth;
    cursor.classList.add('is-press');
    gsap.fromTo(cursor, { scale: 1 }, { scale: 0.82, duration: 0.09, yoyo: true, repeat: 1, ease: 'power2.out' });
    await wait(ctx, 90);
    el.click();
    await wait(ctx, 160);
  };

  const click = async (ctx: Ctx, el: HTMLElement | null, after = 650) => {
    if (!el) return;
    await moveCursor(ctx, el);
    await press(ctx, el);
    await wait(ctx, after);
  };

  const hideMark = () => {
    if (ring) gsap.to(ring, { autoAlpha: 0, duration: 0.25, overwrite: true });
    if (tag) gsap.to(tag, { autoAlpha: 0, y: 4, duration: 0.2, overwrite: true });
  };

  /** Ring an element and tag it with a short note. */
  const mark = async (ctx: Ctx, el: HTMLElement | null, note: string, hold = 1700) => {
    check(ctx);
    if (!visible(el) || !ring || !tag) return;
    await reveal(ctx, el);
    focus(el);
    const r = el.getBoundingClientRect();
    const pad = 6;
    const box = { x: r.left - pad, y: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
    gsap.set(ring, { x: box.x, y: box.y, width: box.width, height: box.height });
    gsap.fromTo(ring, { autoAlpha: 0, scale: 1.06 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'power3.out', overwrite: true });
    if (tagText) tagText.textContent = note;
    // The tag sits under the ring, or above it near the bottom edge; never off the canvas.
    // Keep the tag inside what the camera shows (the whole canvas on a wide stage).
    const viewW = stage.clientWidth / cam.s;
    const viewH = stage.clientHeight / cam.s;
    const left = narrow ? cam.x : 0;
    const top = narrow ? cam.y : 0;
    const tagW = tag.offsetWidth;
    const tagH = tag.offsetHeight;
    const below = box.y + box.height + tagH + 14 < top + viewH;
    const tagY = below ? box.y + box.height + 10 : box.y - 10;
    const tagX = Math.min(Math.max(left + 8, box.x), left + viewW - tagW - 8);
    tag.dataset.side = below ? 'below' : 'above';
    gsap.set(tag, { x: tagX, y: tagY });
    gsap.fromTo(tag, { autoAlpha: 0, yPercent: below ? -20 : -80 }, { autoAlpha: 1, yPercent: below ? 0 : -100, duration: 0.4, delay: 0.12, ease: 'power3.out', overwrite: true });
    await wait(ctx, hold);
    hideMark();
    await wait(ctx, 250);
  };

  const setInput = (input: HTMLInputElement, value: string) => {
    const proto = Object.getPrototypeOf(input) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const type = async (ctx: Ctx, input: HTMLInputElement | null, text: string) => {
    if (!input) return;
    await moveCursor(ctx, input);
    await press(ctx, input);
    input.focus({ preventScroll: true });
    for (let i = 1; i <= text.length; i += 1) {
      setInput(input, text.slice(0, i));
      await wait(ctx, 110);
    }
  };

  const clear = (input: HTMLInputElement | null) => {
    if (!input || !input.value) return;
    setInput(input, '');
    input.blur();
  };

  const scrollTo = async (ctx: Ctx, el: HTMLElement | null, top: number, duration = 0.9) => {
    check(ctx);
    if (!el) return;
    await new Promise<void>((resolve) => {
      gsap.to(el, { scrollTop: top, duration, ease: 'power2.inOut', overwrite: true, onComplete: resolve });
    });
    check(ctx);
  };

  const goToSection = async (ctx: Ctx, index: number, animate: boolean) => {
    const link = sidebarLink(ctx.doc, SECTION_LABELS[index] ?? '');
    if (!link) return;
    resetScroll(ctx.doc);
    const already = link.classList.contains('admin-sidebar-link--active');
    if (!animate) {
      if (!already) link.click();
      return;
    }
    if (already) return;
    await moveCursor(ctx, link, 0.7);
    await press(ctx, link);
    // Let the section mount and its own entrance (charts drawing in) play.
    await wait(ctx, 900);
  };

  /* ---------- Chapter scripts ---------- */

  const scripts: Array<(ctx: Ctx) => Promise<void>> = [
    // 01 Bookings: the live day counts, filter to who is still to come, open a slot.
    async (ctx) => {
      const { doc } = ctx;
      const stat = (label: RegExp) => byText(doc, '.admin-day-summary-stat', label);
      await mark(ctx, doc.querySelector<HTMLElement>('.admin-day-summary-stat')?.parentElement ?? null, 'Today at a glance, live', 1500);
      await click(ctx, stat(/Still to come/), 500);
      await mark(ctx, doc.querySelector<HTMLElement>('.admin-vtl-scroll'), 'Only the clients still to come', 1500);
      await click(ctx, stat(/Bookings today/), 400);
      const scroller = doc.querySelector<HTMLElement>('.admin-vtl-scroll');
      const row = Array.from(doc.querySelectorAll<HTMLElement>('.tl-row--booked')).find((el) => {
        const slot = el.closest<HTMLElement>('[data-vtl-slot]')?.dataset.vtlSlot ?? '';
        return slot >= '14:00';
      }) ?? null;
      if (scroller && row) {
        const target = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 40;
        await scrollTo(ctx, scroller, Math.max(0, target));
      }
      await click(ctx, row, 700);
      await mark(ctx, row?.closest<HTMLElement>('[data-vtl-slot]') ?? row, 'Who, which service, how long', 1800);
      await press(ctx, row);
      await scrollTo(ctx, scroller, 0, 0.7);
    },

    // 02 Team: online bookings and today's shift per barber, then find one barber.
    async (ctx) => {
      const { doc } = ctx;
      await mark(ctx, byText(doc, '.admin-barber-roster-status, .admin-barber-roster-fact-row', /^Online bookings: (On|Off)$/), 'Online bookings, per barber', 1600);
      await mark(ctx, byText(doc, '.admin-barber-roster-shift', /^Today:/), 'Who is on shift today', 1600);
      const input = main(doc).querySelector<HTMLInputElement>('input.admin-search-bar__input, input[type="search"]');
      await type(ctx, input, 'Kit');
      await wait(ctx, 500);
      await mark(ctx, byText(doc, '.admin-barber-roster-name, .admin-barber-name', /Kit/), 'Hours, services and bookings', 1500);
      clear(input);
      await wait(ctx, 400);
    },

    // 03 Reports: walk the ranges, read the comparison, switch the metric.
    async (ctx) => {
      const { doc } = ctx;
      const delta = () => doc.querySelector<HTMLElement>('.admin-analytics-studio__headline-delta-wrap, .admin-analytics-studio__headline-delta');
      await click(ctx, contentButton(doc, '1 Week'), 900);
      await mark(ctx, delta(), 'Against the week before', 1500);
      await click(ctx, contentButton(doc, '1 Month'), 1100);
      await click(ctx, contentButton(doc, '1 Year'), 1100);
      await click(ctx, contentButton(doc, 'Bookings'), 900);
      await mark(ctx, doc.querySelector<HTMLElement>('.admin-analytics-studio__stat--leader')?.parentElement ?? null, 'Leader, cancellations, utilisation, peak', 1900);
      await click(ctx, contentButton(doc, 'Completed value'), 400);
      await click(ctx, contentButton(doc, '1 Day'), 700);
    },

    // 04 Clients: find a regular, read their reliability.
    async (ctx) => {
      const { doc } = ctx;
      const input = main(doc).querySelector<HTMLInputElement>('input[placeholder*="Search by name"], input[type="search"]');
      await type(ctx, input, 'Bramwell');
      await wait(ctx, 600);
      const reliability = Array.from(main(doc).querySelectorAll<HTMLElement>('td, [role="cell"]')).find((el) => /^\d{2,3}$/.test(norm(el.textContent))) ?? null;
      await mark(ctx, reliability, 'Reliability from real visits', 1700);
      const spent = Array.from(main(doc).querySelectorAll<HTMLElement>('td, [role="cell"]')).find((el) => /^£[\d,]+\.\d{2}$/.test(norm(el.textContent))) ?? null;
      await mark(ctx, spent, 'Total spent, kept per client', 1500);
      clear(input);
      await wait(ctx, 500);
    },

    // 05 Sales: the shelf over 7 and 30 days, by value and by units.
    async (ctx) => {
      const { doc } = ctx;
      await click(ctx, contentButton(doc, '30 days'), 1000);
      await click(ctx, contentButton(doc, 'Units'), 1000);
      const top = byText(doc, 'p, span, div', /^Top /);
      await mark(ctx, top?.parentElement ?? top, 'Orders, order value, top product', 1700);
      await click(ctx, contentButton(doc, 'Sales £'), 400);
      await click(ctx, contentButton(doc, '7 days'), 700);
    },
  ];

  /* ---------- Running ---------- */

  const docOf = (): Document | null => {
    try {
      const doc = frame.contentDocument;
      return doc && doc.querySelector('.admin-sidebar-link') ? doc : null;
    } catch {
      return null;
    }
  };

  const stopCurrent = () => {
    controller?.abort();
    controller = null;
    hideMark();
  };

  const run = async (index: number) => {
    stopCurrent();
    const doc = docOf();
    if (!doc) return;
    const ac = new AbortController();
    controller = ac;
    const ctx: Ctx = { doc, signal: ac.signal };
    if (reduced || !running) {
      await goToSection(ctx, index, false).catch(() => {});
      return;
    }
    try {
      await goToSection(ctx, index, true);
      // A pass, a breath, again: the chapter keeps showing itself while it is on screen.
      for (;;) {
        await scripts[index]?.(ctx);
        resetScroll(doc);
        onPass?.(index);
        await wait(ctx, 1400);
      }
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
    }
  };

  const play = (index: number) => {
    chapter = index;
    void run(index);
  };

  return {
    play,
    setRunning(next) {
      if (next === running) return;
      running = next;
      if (!running) {
        stopCurrent();
        if (cursor) gsap.to(cursor, { autoAlpha: 0, duration: 0.2 });
      } else if (chapter >= 0) {
        play(chapter);
      }
    },
    dispose() {
      stopCurrent();
      ro.disconnect();
      gsap.killTweensOf(cam);
      if (cursor) gsap.killTweensOf(cursor);
    },
  };
}
