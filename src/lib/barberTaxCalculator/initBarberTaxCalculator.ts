/**
 * Browser wiring for /self-employed-barber-tax-calculator. No storage, no cookies, no network:
 * inputs live in the form only. Analytics fire only with consent and carry no figures.
 */
import { trackConsentedEvent } from '@/lib/consent/events';
import { NUMERIC_LIMITS, calculateTax, sanitizeInputs, type BarberTaxInputs, type NumericInputKey } from './engine';
import { announceText, buildResultView, buildSummaryText } from './view';

const DEBOUNCE_MS = 120;
const DOCK_QUERY = '(max-width: 1023px)';

function readForm(form: HTMLFormElement): Partial<Record<keyof BarberTaxInputs, unknown>> {
  const raw: Partial<Record<keyof BarberTaxInputs, unknown>> = {};
  for (const key of Object.keys(NUMERIC_LIMITS) as NumericInputKey[]) {
    const field = form.elements.namedItem(key);
    if (field instanceof HTMLInputElement) raw[key] = field.value === '' ? 0 : field.value;
  }
  for (const key of ['taxYear', 'region'] as const) {
    const group = form.elements.namedItem(key);
    if (group instanceof RadioNodeList) raw[key] = group.value;
  }
  return raw;
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

export function initBarberTaxCalculator(): (() => void) | void {
  const form = document.querySelector<HTMLFormElement>('[data-tc-form]');
  const results = document.querySelector<HTMLElement>('#tc-results');
  if (!form || !results) return;

  const page = form.closest('main') ?? document.body;
  const slots = new Map<string, HTMLElement[]>();
  for (const el of page.querySelectorAll<HTMLElement>('[data-slot]')) {
    const name = el.dataset.slot!;
    slots.set(name, [...(slots.get(name) ?? []), el]);
  }
  const hideables = [...page.querySelectorAll<HTMLElement>('[data-hide]')];
  const announce = results.querySelector<HTMLElement>('[data-tc-announce]');
  const status = results.querySelector<HTMLElement>('[data-tc-status]');
  const dock = page.querySelector<HTMLElement>('[data-tc-dock]');

  let used = false;
  let timer: number | undefined;
  let current = calculateTax(readForm(form));

  const render = (fromUser: boolean) => {
    current = calculateTax(readForm(form));
    const view = buildResultView(current);
    for (const [name, value] of Object.entries(view.text)) {
      for (const el of slots.get(name) ?? []) if (el.textContent !== value) el.textContent = value;
    }
    for (const el of hideables) el.hidden = Boolean(view.hidden[el.dataset.hide!]);

    if (fromUser) {
      if (announce) announce.textContent = announceText(current);
      if (!used) {
        used = true;
        trackConsentedEvent('tax_calc_used', { placement: 'barber_tax_calculator' });
      }
    }
  };

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => render(true), DEBOUNCE_MS);
  };

  const onChange = (event: Event) => {
    const target = event.target;
    // Show the clamped value the calculation actually used.
    if (target instanceof HTMLInputElement && target.type === 'number' && target.name in NUMERIC_LIMITS) {
      const repaired = sanitizeInputs(readForm(form));
      target.value = String(Number((repaired[target.name as NumericInputKey] as number).toFixed(2)));
    }
    window.clearTimeout(timer);
    render(true);
  };

  form.addEventListener('input', schedule);
  form.addEventListener('change', onChange);
  form.addEventListener('submit', (event) => event.preventDefault());

  const flash = (message: string) => {
    if (!status) return;
    status.textContent = message;
    window.setTimeout(() => {
      if (status.textContent === message) status.textContent = '';
    }, 4000);
  };

  const onCopy = async () => {
    const ok = await copyText(buildSummaryText(current, `${location.origin}${location.pathname}`));
    flash(ok ? 'Summary copied.' : 'Copy failed — select the results and copy them instead.');
    if (ok) trackConsentedEvent('tax_calc_copied', { placement: 'barber_tax_calculator' });
  };
  const onPrint = () => window.print();
  const copyButton = results.querySelector('[data-tc-copy]');
  const printButton = results.querySelector('[data-tc-print]');
  copyButton?.addEventListener('click', onCopy);
  printButton?.addEventListener('click', onPrint);

  // Mobile dock: the weekly figure stays on screen while the form is being edited.
  let observer: IntersectionObserver | undefined;
  const media = window.matchMedia(DOCK_QUERY);
  let applyDock: (() => void) | undefined;
  if (dock && 'IntersectionObserver' in window) {
    let formVisible = false;
    let resultsVisible = false;
    applyDock = () => {
      dock.hidden = !(media.matches && formVisible && !resultsVisible);
    };
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === form) formVisible = entry.isIntersecting;
        if (entry.target === results) resultsVisible = entry.isIntersecting;
      }
      applyDock?.();
    });
    observer.observe(form);
    observer.observe(results);
    media.addEventListener('change', applyDock);
  }

  render(false);

  return () => {
    observer?.disconnect();
    if (applyDock) media.removeEventListener('change', applyDock);
    form.removeEventListener('input', schedule);
    form.removeEventListener('change', onChange);
    copyButton?.removeEventListener('click', onCopy);
    printButton?.removeEventListener('click', onPrint);
  };
}
