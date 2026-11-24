/**
 * Browser wiring for /barber-price-calculator. No storage, no cookies, no network:
 * inputs live in the form only. Analytics fire only with consent.
 */
import { trackConsentedEvent } from '@/lib/consent/events';
import { MAX_SERVICES, NUMERIC_LIMITS, calculatePrices, sanitizeInputs, type NumericInputKey, type PriceCalcInputs, type PriceCalcResult } from './engine';
import { buildResultView, buildSummaryText, formatClientPrice, formatMinutes, serviceLabel } from './view';

const DEBOUNCE_MS = 120;
const DOCK_QUERY = '(max-width: 1023px)';

function readForm(form: HTMLFormElement, list: HTMLElement): Partial<Record<keyof PriceCalcInputs, unknown>> {
  const raw: Partial<Record<keyof PriceCalcInputs, unknown>> = {};
  for (const key of Object.keys(NUMERIC_LIMITS) as NumericInputKey[]) {
    const field = form.elements.namedItem(key);
    if (field instanceof HTMLInputElement) raw[key] = field.value === '' ? 0 : field.value;
  }
  const vat = form.elements.namedItem('vatRegistered');
  raw.vatRegistered = vat instanceof HTMLInputElement ? vat.checked : false;
  raw.services = [...list.querySelectorAll<HTMLElement>('[data-pc-service]')].map((row) => ({
    name: row.querySelector<HTMLInputElement>('[data-pc-service-name]')?.value ?? '',
    minutes: row.querySelector<HTMLInputElement>('[data-pc-service-minutes]')?.value ?? '',
  }));
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

function renderRows(tbody: HTMLElement, result: PriceCalcResult): void {
  const rows = result.services.map((service, index) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = serviceLabel(service.name, index);
    const sub = document.createElement('span');
    sub.className = 'pc-table__sub';
    sub.textContent = formatMinutes(service.minutes);
    th.append(sub);
    const price = document.createElement('td');
    price.className = 'pc-table__price';
    price.textContent = formatClientPrice(service.targetPriceGbp);
    const floor = document.createElement('td');
    floor.className = 'pc-table__floor';
    floor.textContent = formatClientPrice(service.floorPriceGbp);
    tr.append(th, price, floor);
    return tr;
  });
  tbody.replaceChildren(...rows);
}

export function initPriceCalculator(): (() => void) | void {
  const form = document.querySelector<HTMLFormElement>('[data-pc-form]');
  const results = document.querySelector<HTMLElement>('#pc-results');
  const list = form?.querySelector<HTMLElement>('[data-pc-services]');
  const template = form?.querySelector<HTMLTemplateElement>('[data-pc-service-template]');
  const addButton = form?.querySelector<HTMLButtonElement>('[data-pc-add]');
  const tbody = results?.querySelector<HTMLElement>('[data-pc-rows]');
  if (!form || !results || !list || !template || !addButton || !tbody) return;

  const page = form.closest('main') ?? document.body;
  const slots = new Map<string, HTMLElement[]>();
  for (const el of page.querySelectorAll<HTMLElement>('[data-slot]')) {
    const name = el.dataset.slot!;
    slots.set(name, [...(slots.get(name) ?? []), el]);
  }
  const hideables = [...page.querySelectorAll<HTMLElement>('[data-hide]')];
  const sensRows = [...page.querySelectorAll<HTMLElement>('[data-sens-row]')];
  const announce = results.querySelector<HTMLElement>('[data-pc-announce]');
  const status = results.querySelector<HTMLElement>('[data-pc-status]');
  const dock = page.querySelector<HTMLElement>('[data-pc-dock]');
  const dockService = dock?.querySelector<HTMLElement>('[data-pc-dock-service]');
  const dockPrice = dock?.querySelector<HTMLElement>('[data-pc-dock-price]');

  let used = false;
  let timer: number | undefined;
  let current = calculatePrices(readForm(form, list));

  const syncServiceControls = () => {
    const count = list.querySelectorAll('[data-pc-service]').length;
    addButton.disabled = count >= MAX_SERVICES;
    for (const button of list.querySelectorAll<HTMLButtonElement>('[data-pc-remove]')) button.disabled = count <= 1;
  };

  const render = (fromUser: boolean) => {
    current = calculatePrices(readForm(form, list));
    const view = buildResultView(current);
    for (const [name, value] of Object.entries(view.text)) {
      for (const el of slots.get(name) ?? []) if (el.textContent !== value) el.textContent = value;
    }
    for (const el of hideables) el.hidden = Boolean(view.hidden[el.dataset.hide!]);
    for (const row of sensRows) row.dataset.current = String(Number(row.dataset.sensRow) === Math.round(current.inputs.bookedPercent));
    renderRows(tbody, current);

    const first = current.services[0];
    if (dockService) dockService.textContent = serviceLabel(first?.name ?? '', 0);
    if (dockPrice) dockPrice.textContent = formatClientPrice(first?.targetPriceGbp ?? null);

    if (fromUser) {
      if (announce && first) {
        announce.textContent = `${serviceLabel(first.name, 0)}: ${formatClientPrice(first.targetPriceGbp)}. Each booked hour needs to earn ${view.text['target-hour']}.`;
      }
      if (!used) {
        used = true;
        trackConsentedEvent('price_calc_used', { placement: 'price_calculator' });
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
    if (target instanceof HTMLInputElement && target.type === 'number') {
      const repaired = sanitizeInputs(readForm(form, list));
      if (target.name && target.name in NUMERIC_LIMITS) {
        target.value = String(Number((repaired[target.name as NumericInputKey] as number).toFixed(2)));
      } else if (target.hasAttribute('data-pc-service-minutes')) {
        const index = [...list.querySelectorAll('[data-pc-service]')].indexOf(target.closest('[data-pc-service]')!);
        const minutes = repaired.services[index]?.minutes;
        if (minutes !== undefined) target.value = String(minutes);
      }
    }
    window.clearTimeout(timer);
    render(true);
  };

  // The price rise inputs sit outside the <form> element (form="pc-form"), so listen on the page.
  page.addEventListener('input', schedule);
  page.addEventListener('change', onChange);
  form.addEventListener('submit', (event) => event.preventDefault());

  addButton.addEventListener('click', () => {
    if (list.querySelectorAll('[data-pc-service]').length >= MAX_SERVICES) return;
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const row = fragment.querySelector<HTMLElement>('[data-pc-service]');
    list.append(fragment);
    syncServiceControls();
    row?.querySelector<HTMLInputElement>('[data-pc-service-name]')?.focus();
    render(true);
  });

  list.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-pc-remove]');
    if (!button) return;
    const row = button.closest('[data-pc-service]');
    const rows = [...list.querySelectorAll<HTMLElement>('[data-pc-service]')];
    if (!row || rows.length <= 1) return;
    const index = rows.indexOf(row as HTMLElement);
    row.remove();
    syncServiceControls();
    // Keep focus in the list: the next row's remove button, or the previous one, or "Add".
    const remaining = [...list.querySelectorAll<HTMLButtonElement>('[data-pc-remove]')];
    (remaining[index] ?? remaining[index - 1] ?? addButton).focus();
    render(true);
  });

  const flash = (message: string) => {
    if (!status) return;
    status.textContent = message;
    window.setTimeout(() => {
      if (status.textContent === message) status.textContent = '';
    }, 4000);
  };

  results.querySelector('[data-pc-copy]')?.addEventListener('click', async () => {
    const ok = await copyText(buildSummaryText(current, `${location.origin}${location.pathname}`));
    flash(ok ? 'Prices copied.' : 'Copy failed — select the prices and copy them instead.');
    if (ok) trackConsentedEvent('price_calc_copied', { placement: 'price_calculator' });
  });
  results.querySelector('[data-pc-print]')?.addEventListener('click', () => window.print());

  // Mobile dock: a one-line price summary while the form is on screen, so edits show their effect.
  let observer: IntersectionObserver | undefined;
  const media = window.matchMedia(DOCK_QUERY);
  if (dock && 'IntersectionObserver' in window) {
    let formVisible = false;
    let resultsVisible = false;
    const apply = () => {
      dock.hidden = !(media.matches && formVisible && !resultsVisible);
    };
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === form) formVisible = entry.isIntersecting;
        if (entry.target === results) resultsVisible = entry.isIntersecting;
      }
      apply();
    });
    observer.observe(form);
    observer.observe(results);
    media.addEventListener('change', apply);
  }

  syncServiceControls();
  render(false);

  return () => {
    observer?.disconnect();
    page.removeEventListener('input', schedule);
    page.removeEventListener('change', onChange);
  };
}
