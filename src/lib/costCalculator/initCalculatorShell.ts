/**
 * Client-side behaviour for the calculator UI shell: steppers, input bounds,
 * reveal toggles and the results period selector.
 * Phase 2 only — this module must not price any provider.
 */

const READY_FLAG = 'calcShellReady';

function readNumber(input: HTMLInputElement): number | null {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : null;
}

function bounds(input: HTMLInputElement) {
  return {
    min: input.min === '' ? -Infinity : Number(input.min),
    max: input.max === '' ? Infinity : Number(input.max),
    step: input.step === '' ? 1 : Number(input.step),
  };
}

function clampToBounds(input: HTMLInputElement, value: number): number {
  const { min, max } = bounds(input);
  return Math.min(Math.max(value, min), max);
}

function initSteppers(form: HTMLElement) {
  for (const stepper of form.querySelectorAll<HTMLElement>('[data-calc-stepper]')) {
    const input = stepper.querySelector<HTMLInputElement>('input');
    const buttons = [...stepper.querySelectorAll<HTMLButtonElement>('button[data-step]')];
    if (!input) continue;

    const sync = () => {
      const { min, max } = bounds(input);
      const value = readNumber(input);
      for (const button of buttons) {
        const direction = Number(button.dataset.step);
        const atLimit = value !== null && (direction < 0 ? value <= min : value >= max);
        button.setAttribute('aria-disabled', String(atLimit));
      }
    };

    for (const button of buttons) {
      button.addEventListener('click', () => {
        if (button.getAttribute('aria-disabled') === 'true') return;
        const { min, step } = bounds(input);
        const current = readNumber(input) ?? min;
        input.value = String(clampToBounds(input, current + Number(button.dataset.step) * step));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    sync();
  }
}

function initNumberBounds(form: HTMLElement) {
  for (const input of form.querySelectorAll<HTMLInputElement>('input[type="number"]')) {
    input.addEventListener('change', () => {
      const value = readNumber(input);
      const { min } = bounds(input);
      const next = value === null ? Math.max(min, 0) : clampToBounds(input, value);
      if (String(next) !== input.value) input.value = String(next);
    });
  }
}

function initRevealToggles(form: HTMLElement) {
  for (const toggle of form.querySelectorAll<HTMLInputElement>('input[data-calc-reveal]')) {
    const targetId = toggle.getAttribute('aria-controls');
    const target = targetId ? form.ownerDocument.getElementById(targetId) : null;
    if (!target) continue;
    const sync = () => {
      target.hidden = !toggle.checked;
    };
    toggle.addEventListener('change', sync);
    sync();
  }
}

function initPeriodSelector(results: HTMLElement) {
  const radios = [...results.querySelectorAll<HTMLInputElement>('[data-calc-period] input[type="radio"]')];
  const labels = results.querySelectorAll<HTMLElement>('[data-calc-period-label]');
  const threeYearNote = results.querySelector<HTMLElement>('[data-calc-three-year-note]');

  const sync = () => {
    const selected = radios.find((radio) => radio.checked);
    if (!selected) return;
    for (const label of labels) label.textContent = selected.dataset.resultLabel ?? '';
    if (threeYearNote) threeYearNote.hidden = selected.value !== 'threeYear';
    results.dataset.period = selected.value;
  };

  for (const radio of radios) radio.addEventListener('change', sync);
  sync();
}

export function initCalculatorShell(root: Document) {
  const form = root.querySelector<HTMLFormElement>('[data-calc-form]');
  if (form && !form.dataset[READY_FLAG]) {
    form.dataset[READY_FLAG] = 'true';
    form.addEventListener('submit', (event) => event.preventDefault());
    initSteppers(form);
    initNumberBounds(form);
    initRevealToggles(form);
  }

  const results = root.querySelector<HTMLElement>('[data-calc-results]');
  if (results && !results.dataset[READY_FLAG]) {
    results.dataset[READY_FLAG] = 'true';
    initPeriodSelector(results);
  }
}
