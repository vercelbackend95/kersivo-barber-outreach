/**
 * Interactions for /barbershop-website-design. Plain DOM, no framework.
 * Every control is a native button, range or checkbox, so the page stays usable without this script;
 * this only adds the live states. Returns a cleanup for Astro view transitions.
 */

type Cleanup = () => void;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function pressGroup(buttons: HTMLElement[], active: HTMLElement) {
  for (const button of buttons) button.setAttribute('aria-pressed', button === active ? 'true' : 'false');
}

function initInspector(root: HTMLElement, on: (el: EventTarget, type: string, fn: EventListener) => void) {
  const items = [...root.querySelectorAll<HTMLButtonElement>('[data-point]')];
  const activate = (button: HTMLButtonElement) => {
    root.dataset.active = button.dataset.point ?? '';
    pressGroup(items, button);
  };
  for (const item of items) {
    on(item, 'click', () => activate(item));
    on(item, 'pointerenter', (event) => {
      if ((event as PointerEvent).pointerType === 'mouse') activate(item);
    });
    on(item, 'focus', () => activate(item));
  }
}

function initCompare(root: HTMLElement, on: (el: EventTarget, type: string, fn: EventListener) => void): Cleanup {
  const range = root.querySelector<HTMLInputElement>('[data-wd-compare-range]');
  const questions = [...document.querySelectorAll<HTMLElement>('[data-wd-glance-questions] [data-step]')];
  if (!range) return () => {};

  const paint = (value: number) => {
    root.style.setProperty('--pos', `${value}%`);
    const designedShare = 100 - value;
    range.setAttribute(
      'aria-valuetext',
      value >= 85 ? 'Mostly generic template' : value <= 15 ? 'Mostly designed page' : `${Math.round(designedShare)}% designed page shown`,
    );
    // Each question is answered as more of the designed page is revealed.
    questions.forEach((question, index) => {
      question.dataset.on = designedShare >= 35 + index * 10 ? 'true' : 'false';
    });
  };

  on(range, 'input', () => paint(Number(range.value)));
  paint(Number(range.value));

  // One-off hint when the comparison first enters view: the divider sweeps to reveal the designed page.
  if (reducedMotion() || !('IntersectionObserver' in window)) return () => {};
  let frame = 0;
  let touched = false;
  on(range, 'pointerdown', () => {
    touched = true;
    cancelAnimationFrame(frame);
  });
  on(range, 'keydown', () => {
    touched = true;
    cancelAnimationFrame(frame);
  });
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const from = Number(range.value);
      const keys = [
        { at: 0, v: from },
        { at: 0.45, v: 12 },
        { at: 1, v: 30 },
      ];
      const duration = 1900;
      const start = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const step = (now: number) => {
        if (touched) return;
        const t = Math.min(1, (now - start) / duration);
        const seg = t < keys[1].at ? 0 : 1;
        const a = keys[seg];
        const b = keys[seg + 1];
        const local = ease((t - a.at) / (b.at - a.at));
        const value = a.v + (b.v - a.v) * local;
        range.value = String(Math.round(value));
        paint(value);
        if (t < 1) frame = requestAnimationFrame(step);
      };
      window.setTimeout(() => {
        if (!touched) frame = requestAnimationFrame(step);
      }, 350);
    },
    { threshold: 0.55 },
  );
  observer.observe(root);
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}

function initGroup(
  root: HTMLElement,
  selector: string,
  key: string,
  datasetKey: 'layer' | 'shot',
  on: (el: EventTarget, type: string, fn: EventListener) => void,
  hover = false,
) {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>(selector)];
  const activate = (button: HTMLButtonElement) => {
    root.dataset[datasetKey] = button.getAttribute(key) ?? '';
    pressGroup(buttons, button);
  };
  for (const button of buttons) {
    on(button, 'click', () => activate(button));
    if (hover) {
      on(button, 'pointerenter', (event) => {
        if ((event as PointerEvent).pointerType === 'mouse') activate(button);
      });
    }
  }
}

function initBrand(root: HTMLElement, on: (el: EventTarget, type: string, fn: EventListener) => void) {
  const preview = root.querySelector<HTMLElement>('[data-wd-brand-preview]');
  if (!preview) return;
  for (const input of root.querySelectorAll<HTMLInputElement>('[data-wd-palette], [data-wd-type]')) {
    on(input, 'change', () => {
      if (!input.checked) return;
      if (input.hasAttribute('data-wd-palette')) preview.dataset.palette = input.value;
      else preview.dataset.type = input.value;
      if (!reducedMotion()) {
        preview.classList.remove('is-swapping');
        void preview.offsetWidth;
        preview.classList.add('is-swapping');
      }
    });
  }
}

function initAudit(root: HTMLElement, on: (el: EventTarget, type: string, fn: EventListener) => void) {
  const items = [...root.querySelectorAll<HTMLInputElement>('[data-wd-audit-item]')];
  const score = root.querySelector<HTMLElement>('[data-wd-score]');
  const count = root.querySelector<HTMLElement>('[data-wd-score-count]');
  const tiers = [...root.querySelectorAll<HTMLElement>('[data-min]')];
  if (!score || !count) return;
  const update = () => {
    const ticked = items.filter((item) => item.checked).length;
    score.style.setProperty('--p', String(ticked / items.length));
    count.textContent = String(ticked);
    let current = tiers[0];
    for (const tier of tiers) if (ticked >= Number(tier.dataset.min)) current = tier;
    for (const tier of tiers) tier.hidden = tier !== current;
    score.dataset.level = String(tiers.indexOf(current));
  };
  for (const item of items) on(item, 'change', update);
  update();
}

export function initWebsiteDesign(doc: Document = document): Cleanup {
  const disposers: Cleanup[] = [];
  const on = (el: EventTarget, type: string, fn: EventListener) => {
    el.addEventListener(type, fn);
    disposers.push(() => el.removeEventListener(type, fn));
  };

  const inspector = doc.querySelector<HTMLElement>('[data-wd-inspector]');
  if (inspector) initInspector(inspector, on);

  const compare = doc.querySelector<HTMLElement>('[data-wd-compare]');
  if (compare) disposers.push(initCompare(compare, on));

  const mobile = doc.querySelector<HTMLElement>('[data-wd-mobile]');
  if (mobile) initGroup(mobile, '[data-layer-button]', 'data-layer-button', 'layer', on);

  const photo = doc.querySelector<HTMLElement>('[data-wd-photo]');
  if (photo) initGroup(photo, '[data-shot-button]', 'data-shot-button', 'shot', on, true);

  const brand = doc.querySelector<HTMLElement>('.wd-brand');
  if (brand) initBrand(brand, on);

  const audit = doc.querySelector<HTMLElement>('[data-wd-audit]');
  if (audit) initAudit(audit, on);

  return () => {
    for (const dispose of disposers.splice(0)) dispose();
  };
}
