/**
 * Stage selector for the /barbershop-online-booking client journey (Section 02).
 *
 * The server renders every stage's text and every booking state, with the first stage active.
 * Two control groups select stages — the compact step selector (below 64rem) and the stage rail
 * (64rem+); CSS shows one group at a time. Previous / Next buttons step through the same state.
 * This module keeps one selected index for all of them: it presses the matching buttons, shows
 * the stage text and its panel, keeps the other panels inert and announces the change. Without it
 * the page still reads top to bottom (a noscript style shows every stage and panel).
 */

export const JOURNEY_KEYS = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'] as const;

/** Index the keyboard should move to from `current`, or null when the key is not a navigation key. */
export function nextStageIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowUp':
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** Stage reached by a Previous (-1) / Next (+1) step, or null at either end. */
export function steppedStageIndex(current: number, direction: number, count: number): number | null {
  const next = current + Math.sign(direction);
  return next >= 0 && next < count ? next : null;
}

/**
 * Binds every journey on the page. Safe to call repeatedly; each journey is bound once and
 * unbound before a soft swap.
 */
export function bindBookingJourney(win: Window & typeof globalThis = window): void {
  const doc = win.document;
  for (const root of doc.querySelectorAll<HTMLElement>('[data-boj]')) {
    if (root.dataset.bojBound === 'true') continue;

    const stages = [...root.querySelectorAll<HTMLElement>('[data-boj-stage]')];
    const panels = [...root.querySelectorAll<HTMLElement>('[data-boj-panel]')];
    const selects = [...root.querySelectorAll<HTMLButtonElement>('[data-boj-select]')];
    const steppers = [...root.querySelectorAll<HTMLButtonElement>('[data-boj-step]')];
    const status = root.querySelector<HTMLElement>('[data-boj-status]');
    const count = root.querySelector<HTMLElement>('[data-boj-count]');
    const anchor = root.querySelector<HTMLElement>('[data-boj-anchor]');
    if (stages.length === 0 || panels.length !== stages.length || selects.length === 0) continue;
    root.dataset.bojBound = 'true';

    const total = stages.length;
    const indexOf = (button: HTMLButtonElement) => Number(button.dataset.bojSelect);
    let current = 0;

    const select = (index: number, announce: boolean) => {
      current = index;
      stages.forEach((stage, i) => stage.classList.toggle('is-active', i === index));
      panels.forEach((panel, i) => {
        const active = i === index;
        panel.classList.toggle('is-active', active);
        panel.toggleAttribute('inert', !active);
        if (active) panel.removeAttribute('aria-hidden');
        else panel.setAttribute('aria-hidden', 'true');
      });
      for (const button of selects) {
        const i = indexOf(button);
        button.setAttribute('aria-pressed', String(i === index));
        button.classList.toggle('is-done', i < index);
      }
      for (const stepper of steppers) {
        stepper.setAttribute('aria-disabled', String(steppedStageIndex(index, Number(stepper.dataset.bojStep), total) === null));
      }
      if (count) count.textContent = `${index + 1} / ${total}`;
      if (announce && status) {
        const title = stages[index].querySelector('h3')?.textContent?.trim() ?? '';
        status.textContent = `Showing step ${index + 1} of ${total}: ${title}`;
      }
    };

    const pressed = selects.find((button) => button.getAttribute('aria-pressed') === 'true');
    select(pressed ? indexOf(pressed) : 0, false);

    const onSelectClick = (event: Event) => {
      const index = indexOf(event.currentTarget as HTMLButtonElement);
      if (index >= 0 && index < total) select(index, true);
    };
    const onSelectKeydown = (event: KeyboardEvent) => {
      const button = event.currentTarget as HTMLButtonElement;
      const group = [...(button.closest('[data-boj-group]') ?? root).querySelectorAll<HTMLButtonElement>('[data-boj-select]')];
      const next = nextStageIndex(event.key, group.indexOf(button), group.length);
      if (next === null) return;
      event.preventDefault();
      group[next].focus();
      select(indexOf(group[next]), true);
    };
    // Previous / Next sit below the preview; if the step selector has scrolled out of view above,
    // bring it back so the new step's explanation is read with its preview.
    const onStepClick = (event: Event) => {
      const next = steppedStageIndex(current, Number((event.currentTarget as HTMLElement).dataset.bojStep), total);
      if (next === null) return;
      select(next, true);
      if (anchor && typeof anchor.scrollIntoView === 'function' && anchor.getBoundingClientRect().top < 0) {
        const reduce = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        anchor.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      }
    };

    for (const button of selects) {
      button.addEventListener('click', onSelectClick);
      button.addEventListener('keydown', onSelectKeydown);
    }
    for (const stepper of steppers) stepper.addEventListener('click', onStepClick);

    doc.addEventListener(
      'astro:before-swap',
      () => {
        for (const button of selects) {
          button.removeEventListener('click', onSelectClick);
          button.removeEventListener('keydown', onSelectKeydown);
        }
        for (const stepper of steppers) stepper.removeEventListener('click', onStepClick);
        delete root.dataset.bojBound;
      },
      { once: true },
    );
  }
}
