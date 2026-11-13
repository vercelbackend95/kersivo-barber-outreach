/** Listing-to-shop wipe on the homepage hero: pointer drag, keyboard slider and a programmatic setter for motion. */
export type WipeController = {
  set: (percent: number) => void;
  get: () => number;
  rest: () => number;
  min: () => number;
  /** True once the visitor has dragged or used the keyboard; motion stops driving the split then. */
  touched: () => boolean;
  destroy: () => void;
};

const DESKTOP = '(min-width: 48rem)';

export function createWipe(stage: HTMLElement): WipeController | null {
  const grip = stage.querySelector<HTMLElement>('[data-hv2-grip]');
  if (!grip) return null;

  const desktop = window.matchMedia(DESKTOP);
  const rest = () => (desktop.matches ? 47.3 : 22);
  const min = () => (desktop.matches ? 6 : 8);
  const max = () => (desktop.matches ? 94 : 92);

  let value = rest();
  let touched = false;
  let dragging = false;

  const set = (percent: number) => {
    value = Math.min(max(), Math.max(min(), percent));
    stage.style.setProperty('--split', `${value}%`);
    const listing = Math.round(value);
    grip.setAttribute('aria-valuenow', String(listing));
    grip.setAttribute('aria-valuetext', `${listing}% marketplace listing, ${100 - listing}% your own website`);
  };

  const fromPointer = (clientX: number) => {
    const box = stage.getBoundingClientRect();
    set(((clientX - box.left) / box.width) * 100);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    touched = true;
    dragging = true;
    stage.classList.add('is-dragging');
    grip.setPointerCapture(event.pointerId);
    fromPointer(event.clientX);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (dragging) fromPointer(event.clientX);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-dragging');
    if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 15 : 5;
    const moves: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageUp: 20,
      PageDown: -20,
    };
    if (event.key === 'Home') set(min());
    else if (event.key === 'End') set(max());
    else if (event.key in moves) set(value + moves[event.key]);
    else return;
    touched = true;
    event.preventDefault();
  };

  const onBreakpoint = () => {
    if (!touched) set(rest());
  };

  grip.addEventListener('pointerdown', onPointerDown);
  grip.addEventListener('pointermove', onPointerMove);
  grip.addEventListener('pointerup', onPointerUp);
  grip.addEventListener('pointercancel', onPointerUp);
  grip.addEventListener('keydown', onKeyDown);
  desktop.addEventListener('change', onBreakpoint);
  set(value);

  return {
    set,
    get: () => value,
    rest,
    min,
    touched: () => touched,
    destroy: () => {
      grip.removeEventListener('pointerdown', onPointerDown);
      grip.removeEventListener('pointermove', onPointerMove);
      grip.removeEventListener('pointerup', onPointerUp);
      grip.removeEventListener('pointercancel', onPointerUp);
      grip.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onBreakpoint);
    },
  };
}
