/**
 * Browser wiring for /barbershop-price-list-template. Everything stays in the page:
 * no network calls, no storage, no cookies.
 */
import { trackConsentedEvent } from '@/lib/consent/events';
import {
  PRICE_LIST_MAX_ITEMS,
  buildPriceListText,
  formatItemPrice,
  formatMinutes,
  itemsMissingPrice,
  normalisePriceList,
  parsePriceGbp,
  type PriceListItem,
  type PriceListOptions,
} from './priceListText';

function readRow(row: HTMLElement): PriceListItem {
  const value = (selector: string) => row.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value ?? '';
  const minutes = Number(value('[data-pl-minutes]'));
  return {
    name: value('[data-pl-name]'),
    priceGbp: parsePriceGbp(value('[data-pl-price]')),
    from: row.querySelector<HTMLInputElement>('[data-pl-from]')?.checked ?? false,
    minutes: minutes > 0 ? minutes : null,
  };
}

function readOptions(form: HTMLFormElement, rows: HTMLElement): PriceListOptions {
  return {
    shopName: (form.elements.namedItem('shop') as HTMLInputElement | null)?.value ?? '',
    footer: (form.elements.namedItem('footer') as HTMLInputElement | null)?.value ?? '',
    showDuration: (form.elements.namedItem('duration') as HTMLInputElement | null)?.checked ?? false,
    items: Array.from(rows.querySelectorAll<HTMLElement>('[data-pl-row]')).map(readRow),
  };
}

function renderPreview(sheet: HTMLElement, input: PriceListOptions): void {
  const options = normalisePriceList(input);
  const title = sheet.querySelector<HTMLElement>('[data-pl-sheet-title]');
  const list = sheet.querySelector<HTMLElement>('[data-pl-sheet-list]');
  const footer = sheet.querySelector<HTMLElement>('[data-pl-sheet-footer]');
  if (!title || !list || !footer) return;

  title.textContent = options.shopName || 'Your barbershop';
  list.replaceChildren(
    ...options.items.map((item) => {
      const li = document.createElement('li');
      li.className = 'pl-sheet__item';
      const name = document.createElement('span');
      name.className = 'pl-sheet__name';
      name.textContent = item.name;
      if (options.showDuration && item.minutes !== null) {
        const time = document.createElement('span');
        time.className = 'pl-sheet__time';
        time.textContent = formatMinutes(item.minutes);
        name.append(' ', time);
      }
      const leader = document.createElement('span');
      leader.className = 'pl-sheet__leader';
      leader.setAttribute('aria-hidden', 'true');
      const price = document.createElement('span');
      price.className = 'pl-sheet__price';
      if (item.priceGbp === null) price.dataset.missing = 'true';
      price.textContent = formatItemPrice(item);
      li.append(name, leader, price);
      return li;
    }),
  );
  footer.textContent = options.footer;
  footer.hidden = options.footer.length === 0;
}

export function initPriceListTool(): (() => void) | void {
  const form = document.getElementById('pl-form') as HTMLFormElement | null;
  const rows = document.getElementById('pl-rows');
  const template = document.getElementById('pl-row-template') as HTMLTemplateElement | null;
  const sheet = document.getElementById('pl-sheet');
  const addButton = document.getElementById('pl-add') as HTMLButtonElement | null;
  const copyButton = document.getElementById('pl-copy');
  const printButton = document.getElementById('pl-print');
  const status = document.getElementById('pl-status');
  const missing = document.getElementById('pl-missing');
  if (!form || !rows || !template || !sheet || !addButton || !copyButton || !printButton || !status || !missing) return;

  const update = () => {
    const options = readOptions(form, rows);
    renderPreview(sheet, options);
    const gaps = itemsMissingPrice(options);
    missing.textContent = gaps.length ? `Add a price for: ${gaps.join(', ')}.` : '';
    missing.hidden = gaps.length === 0;
    addButton.disabled = rows.querySelectorAll('[data-pl-row]').length >= PRICE_LIST_MAX_ITEMS;
  };

  const addRow = (focus: boolean) => {
    if (rows.querySelectorAll('[data-pl-row]').length >= PRICE_LIST_MAX_ITEMS) return;
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const row = fragment.querySelector<HTMLElement>('[data-pl-row]');
    rows.append(fragment);
    if (focus) row?.querySelector<HTMLInputElement>('[data-pl-name]')?.focus();
    update();
  };

  const onRowsClick = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pl-remove]');
    if (!button) return;
    const row = button.closest<HTMLElement>('[data-pl-row]');
    const next = row?.nextElementSibling ?? row?.previousElementSibling;
    row?.remove();
    (next?.querySelector<HTMLInputElement>('[data-pl-name]') ?? addButton).focus();
    update();
  };

  const onAdd = () => addRow(true);

  const onCopy = async () => {
    const options = readOptions(form, rows);
    try {
      await navigator.clipboard.writeText(buildPriceListText(options));
      status.textContent = 'Price list copied as text.';
      trackConsentedEvent('price_list_copy', { placement: 'price_list_template' });
    } catch {
      status.textContent = 'Copy failed. Select the preview text instead.';
    }
  };

  const onPrint = () => {
    trackConsentedEvent('price_list_print', { placement: 'price_list_template' });
    window.print();
  };

  const onSubmit = (event: Event) => event.preventDefault();

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', onSubmit);
  rows.addEventListener('click', onRowsClick);
  addButton.addEventListener('click', onAdd);
  copyButton.addEventListener('click', onCopy);
  printButton.addEventListener('click', onPrint);
  update();

  return () => {
    form.removeEventListener('input', update);
    form.removeEventListener('change', update);
    form.removeEventListener('submit', onSubmit);
    rows.removeEventListener('click', onRowsClick);
    addButton.removeEventListener('click', onAdd);
    copyButton.removeEventListener('click', onCopy);
    printButton.removeEventListener('click', onPrint);
  };
}
