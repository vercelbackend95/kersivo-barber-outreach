/**
 * Browser wiring for /chair-rent-vs-commission-calculator. No storage, no cookies, no network:
 * inputs live in the form and (optionally) the URL hash. Analytics only fire with consent.
 */
import { trackConsentedEvent } from '@/lib/consent/events';
import { DEFAULT_INPUTS, compareModels, sanitizeInputs, type ChairRentInputs } from './engine';
import { hashToInputs, inputsToHash } from './urlState';
import { buildResultView, buildSummaryText } from './view';

const DEBOUNCE_MS = 150;
const TABS_QUERY = '(max-width: 899px)';

function readForm(form: HTMLFormElement): Partial<Record<keyof ChairRentInputs, unknown>> {
  const raw: Partial<Record<keyof ChairRentInputs, unknown>> = {};
  for (const key of Object.keys(DEFAULT_INPUTS) as (keyof ChairRentInputs)[]) {
    const fields = form.elements.namedItem(key);
    if (!fields) continue;
    if (fields instanceof RadioNodeList) {
      raw[key] = fields.value === '1';
    } else if (fields instanceof HTMLInputElement && fields.type === 'checkbox') {
      raw[key] = fields.checked;
    } else if (fields instanceof HTMLInputElement || fields instanceof HTMLSelectElement) {
      raw[key] = fields.value === '' ? 0 : fields.value;
    }
  }
  return raw;
}

function writeForm(form: HTMLFormElement, inputs: ChairRentInputs): void {
  for (const key of Object.keys(inputs) as (keyof ChairRentInputs)[]) {
    const fields = form.elements.namedItem(key);
    const value = inputs[key];
    if (!fields) continue;
    if (fields instanceof RadioNodeList) {
      fields.value = value ? '1' : '0';
    } else if (fields instanceof HTMLInputElement && fields.type === 'checkbox') {
      fields.checked = Boolean(value);
    } else if (fields instanceof HTMLInputElement || fields instanceof HTMLSelectElement) {
      fields.value = String(typeof value === 'number' ? Number(value.toFixed(2)) : value);
    }
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

function initTabs(form: HTMLFormElement): void {
  const tablist = form.querySelector<HTMLElement>('[data-crc-tabs]');
  if (!tablist) return;
  const tabs = [...tablist.querySelectorAll<HTMLButtonElement>('[data-crc-tab]')];
  const panels = [...form.querySelectorAll<HTMLElement>('[data-crc-panel]')];
  const media = window.matchMedia(TABS_QUERY);

  const select = (id: string, focus = false) => {
    for (const tab of tabs) {
      const active = tab.dataset.crcTab === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    for (const panel of panels) panel.dataset.active = String(panel.dataset.crcPanel === id);
  };

  const apply = () => {
    const tabbed = media.matches;
    tablist.hidden = !tabbed;
    form.classList.toggle('is-tabbed', tabbed);
    for (const panel of panels) {
      if (tabbed) {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', `crc-tab-${panel.dataset.crcPanel}`);
      } else {
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
      }
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.crcTab!));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next.dataset.crcTab!, true);
    });
  });
  media.addEventListener('change', apply);
  select('a');
  apply();
}

export function initChairRentCalculator(root: Document = document): void {
  const form = root.querySelector<HTMLFormElement>('[data-crc-form]');
  const results = root.querySelector<HTMLElement>('#results');
  if (!form || !results || form.dataset.crcReady === 'true') return;
  form.dataset.crcReady = 'true';

  const slots = new Map<string, HTMLElement[]>();
  for (const el of results.querySelectorAll<HTMLElement>('[data-slot]')) {
    const name = el.dataset.slot!;
    slots.set(name, [...(slots.get(name) ?? []), el]);
  }
  const hideables = [...results.querySelectorAll<HTMLElement>('[data-hide]')];
  const conditional = [...form.querySelectorAll<HTMLElement>('[data-show-when]')];
  const announce = results.querySelector<HTMLElement>('[data-crc-announce]');
  const status = results.querySelector<HTMLElement>('[data-crc-status]');

  let used = false;
  let timer: number | undefined;
  let current = compareModels(DEFAULT_INPUTS);

  const pageUrl = () => `${location.origin}${location.pathname}${inputsToHash(current.inputs)}`;

  const render = (fromUser: boolean) => {
    current = compareModels(readForm(form));
    const view = buildResultView(current);
    for (const [name, value] of Object.entries(view.text)) {
      for (const el of slots.get(name) ?? []) if (el.textContent !== value) el.textContent = value;
    }
    for (const el of hideables) el.hidden = Boolean(view.hidden[el.dataset.hide!]);
    for (const el of conditional) el.hidden = !current.inputs[el.dataset.showWhen as keyof ChairRentInputs];

    if (fromUser) {
      const hash = inputsToHash(current.inputs);
      history.replaceState(history.state, '', `${location.pathname}${hash}`);
      if (announce) announce.textContent = `${view.text.verdict} ${view.text['be-rent']}`;
      if (!used) {
        used = true;
        trackConsentedEvent('rentcomm_calc_used', { placement: 'chair_rent_calculator' });
      }
    }
  };

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => render(true), DEBOUNCE_MS);
  };

  form.addEventListener('input', schedule);
  form.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.name === 'wageBand') {
      const apprentice = form.elements.namedItem('apprenticeUnder25');
      // Pre-tick the under-25 relief for the apprentice band; the owner can untick it.
      if (apprentice instanceof HTMLInputElement && target.value === 'apprentice') apprentice.checked = true;
    }
    // Show the clamped value the calculation actually used.
    if (target instanceof HTMLInputElement && target.type === 'number') {
      const repaired = sanitizeInputs(readForm(form));
      const key = target.name as keyof ChairRentInputs;
      target.value = String(Number((repaired[key] as number).toFixed(2)));
    }
    window.clearTimeout(timer);
    render(true);
  });
  form.addEventListener('submit', (event) => event.preventDefault());

  const flash = (message: string) => {
    if (!status) return;
    status.textContent = message;
    window.setTimeout(() => {
      if (status.textContent === message) status.textContent = '';
    }, 4000);
  };

  results.querySelector('[data-crc-copy]')?.addEventListener('click', async () => {
    const ok = await copyText(buildSummaryText(current, pageUrl()));
    flash(ok ? 'Summary copied.' : 'Copy failed — select the results and copy them instead.');
    if (ok) trackConsentedEvent('rentcomm_summary_copied', { placement: 'chair_rent_calculator' });
  });
  results.querySelector('[data-crc-share]')?.addEventListener('click', async () => {
    const ok = await copyText(pageUrl());
    flash(ok ? 'Link copied. It contains only your inputs, after the # sign.' : 'Copy failed — copy the address bar instead.');
  });
  results.querySelector('[data-crc-print]')?.addEventListener('click', () => window.print());

  initTabs(form);

  if (location.hash.length > 1) {
    writeForm(form, hashToInputs(location.hash));
  }
  render(false);

  // A share link opened while already on the page is a same-document hash change.
  // (Our own replaceState updates never fire hashchange.)
  window.addEventListener('hashchange', () => {
    writeForm(form, hashToInputs(location.hash));
    render(false);
  });
}
