/**
 * Browser wiring for /barbershop-no-show-calculator. Reads the form, recalculates
 * (debounced), writes the result strings into [data-ns] slots and keeps the
 * numbers in the URL hash (#p=25&a=80…) so a link can be shared. No storage,
 * cookies or network calls; analytics only via the consent-gated helper.
 */
import { trackConsentedEvent } from '@/lib/consent/events';
import { calculateNoShowCost, type NoShowInputs } from './noShowCalculator';
import { NUMERIC_FIELDS, clampField, decodeHash, encodeHash, normaliseInputs, parseNumber } from './noShowInputs';
import { buildNoShowSummary, buildNoShowView, type NoShowView } from './noShowView';

const DEBOUNCE_MS = 150;
const CHART_WIDTH = 320;

type TextKey = Exclude<keyof NoShowView, 'chart' | 'depositTone'>;

function readInputs(form: HTMLFormElement): NoShowInputs {
  const data = new FormData(form);
  const partial: Record<string, unknown> = {};
  for (const field of NUMERIC_FIELDS) partial[field.key] = data.get(field.key);
  for (const name of ['shopPayment', 'chairModel', 'depositType', 'balancePayment', 'keepDepositWhenRefilled']) {
    partial[name] = data.get(name);
  }
  return normaliseInputs(partial);
}

function writeInputs(form: HTMLFormElement, inputs: NoShowInputs): void {
  for (const field of NUMERIC_FIELDS) {
    const el = form.elements.namedItem(field.key);
    if (el instanceof HTMLInputElement) el.value = String(inputs[field.key]);
  }
  const choices: Record<string, string> = {
    shopPayment: inputs.shopPayment,
    chairModel: inputs.chairModel,
    depositType: inputs.depositType,
    balancePayment: inputs.balancePayment,
    keepDepositWhenRefilled: inputs.keepDepositWhenRefilled ? 'yes' : 'no',
  };
  for (const [name, value] of Object.entries(choices)) {
    form.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`).forEach((radio) => {
      radio.checked = radio.value === value;
    });
  }
}

function setText(root: ParentNode, key: string, text: string): void {
  root.querySelectorAll<HTMLElement>(`[data-ns="${key}"]`).forEach((el) => {
    if (el.textContent !== text) el.textContent = text;
    if (el.hasAttribute('hidden') || key === 'depositNote' || key === 'fairnessWarning') el.hidden = text === '';
  });
}

function render(root: HTMLElement, inputs: NoShowInputs): NoShowView {
  const view = buildNoShowView(inputs, calculateNoShowCost(inputs));
  for (const [key, value] of Object.entries(view)) {
    if (typeof value === 'string' && key !== 'depositTone') setText(root, key as TextKey, value);
  }
  setText(root, 'chartWithout', view.chart.withoutLabel);
  setText(root, 'chartWith', view.chart.withLabel);
  setText(root, 'chartWithName', view.chart.withName);

  const svg = root.querySelector<SVGSVGElement>('[data-ns-chart]');
  svg?.setAttribute('aria-label', view.chart.ariaLabel);
  root.querySelector('[data-ns-bar="without"]')?.setAttribute('width', (view.chart.withoutWidth * CHART_WIDTH).toFixed(1));
  root.querySelector('[data-ns-bar="with"]')?.setAttribute('width', (view.chart.withWidth * CHART_WIDTH).toFixed(1));

  const card = root.querySelector<HTMLElement>('[data-ns-deposit-card]');
  card?.classList.toggle('ns-tone--positive', view.depositTone === 'positive');
  card?.classList.toggle('ns-tone--neutral', view.depositTone === 'neutral');

  root.querySelectorAll<HTMLElement>('[data-ns-show="commission"]').forEach((el) => (el.hidden = inputs.chairModel !== 'commission'));
  root.querySelectorAll<HTMLElement>('[data-ns-show="custom"]').forEach((el) => (el.hidden = inputs.depositType !== 'custom'));
  root.querySelectorAll<HTMLElement>('[data-ns-hide="full"]').forEach((el) => (el.hidden = inputs.depositType === 'full'));
  root.querySelectorAll<HTMLElement>('[data-ns-show-kept]').forEach((el) => (el.hidden = !inputs.keepDepositWhenRefilled));
  return view;
}

/** Inline errors for out-of-range or unreadable entries; the calculation always uses the clamped value. */
function validate(form: HTMLFormElement): void {
  const appointments = parseNumber((form.elements.namedItem('appointments') as HTMLInputElement | null)?.value) ?? 0;
  for (const field of NUMERIC_FIELDS) {
    const input = form.elements.namedItem(field.key);
    const error = form.querySelector<HTMLElement>(`[data-ns-error="${field.key}"]`);
    if (!(input instanceof HTMLInputElement) || !error) continue;
    const raw = input.value.trim();
    const value = parseNumber(raw);
    let message = '';
    if (raw !== '' && value === null) message = 'Enter a number.';
    else if (value !== null && (value < field.min || value > field.max)) {
      message = `Enter a number from ${field.min} to ${field.max}.`;
    } else if (field.key === 'noShows' && value !== null && value > appointments) {
      message = 'No-shows can’t be more than appointments booked.';
    }
    error.textContent = message;
    error.hidden = message === '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export function initNoShowCalculator(): void | (() => void) {
  const form = document.querySelector<HTMLFormElement>('[data-ns-form]');
  if (!form || form.dataset.nsReady) return;
  form.dataset.nsReady = 'true';

  let inputs = readInputs(form);
  const fromHash = decodeHash(window.location.hash);
  if (fromHash) {
    inputs = fromHash;
    writeInputs(form, inputs);
  }
  let view = render(form, inputs);

  let timer: number | undefined;
  let used = false;
  const status = form.querySelector<HTMLElement>('[data-ns-status]');
  const say = (message: string) => {
    if (status) status.textContent = message;
  };

  const update = () => {
    validate(form);
    inputs = readInputs(form);
    view = render(form, inputs);
    history.replaceState(null, '', `${window.location.pathname}${encodeHash(inputs)}`);
    if (!used) {
      used = true;
      trackConsentedEvent('noshow_calc_used');
    }
  };
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(update, DEBOUNCE_MS);
  };

  form.addEventListener('input', schedule);
  form.addEventListener('change', (event) => {
    const target = event.target;
    // On leaving a field, show the value actually used.
    if (target instanceof HTMLInputElement && target.type === 'text') {
      const field = NUMERIC_FIELDS.find((f) => f.key === target.name);
      if (field) {
        const clamped = clampField(field, parseNumber(target.value));
        target.value = String(field.key === 'noShows' ? Math.min(clamped, inputs.appointments) : clamped);
      }
    }
    schedule();
  });
  form.addEventListener('submit', (event) => event.preventDefault());
  // replaceState never fires this, so it only reacts to a pasted or edited link.
  const listeners = new AbortController();
  window.addEventListener(
    'hashchange',
    () => {
      const next = decodeHash(window.location.hash);
      if (!next) return;
      inputs = next;
      writeInputs(form, inputs);
      validate(form);
      view = render(form, inputs);
    },
    { signal: listeners.signal },
  );

  form.querySelector('[data-ns-copy]')?.addEventListener('click', async () => {
    window.clearTimeout(timer);
    update();
    const url = `${window.location.origin}${window.location.pathname}${encodeHash(inputs)}`;
    const ok = await copyText(buildNoShowSummary(inputs, view, url));
    say(ok ? 'Summary copied.' : 'Couldn’t copy — select the results and copy them instead.');
    if (ok) trackConsentedEvent('noshow_summary_copied');
  });
  form.querySelector('[data-ns-share]')?.addEventListener('click', async () => {
    window.clearTimeout(timer);
    update();
    const ok = await copyText(`${window.location.origin}${window.location.pathname}${encodeHash(inputs)}`);
    say(ok ? 'Link copied. It holds your numbers after the # sign only.' : 'Couldn’t copy the link — copy it from the address bar.');
  });
  form.querySelector('[data-ns-print]')?.addEventListener('click', () => {
    const details = form.querySelector<HTMLDetailsElement>('[data-ns-details]');
    if (details) details.open = true;
    window.print();
  });

  return () => listeners.abort();
}
