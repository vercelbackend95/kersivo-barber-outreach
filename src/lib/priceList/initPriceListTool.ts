/**
 * Browser wiring for the /barbershop-price-list-template tool. Everything stays in the page:
 * no network calls, no storage, no cookies.
 *
 * The sheet is keyed to the form rows (data-pl-uid), so a row that is added, removed or moved
 * animates on both sides instead of the whole list re-rendering. Under prefers-reduced-motion every
 * change is applied at once.
 */
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { trackConsentedEvent } from '@/lib/consent/events';
import {
  PRICE_LIST_MAX_ITEMS,
  buildPriceListText,
  formatItemPrice,
  formatMinutes,
  hourlyRateGbp,
  normalisePriceList,
  parsePriceGbp,
  type PriceListItem,
  type PriceListOptions,
} from './priceListText';
import { getPriceListTheme, priceListThemeStyle, type PriceListTheme } from './priceListThemes';
import {
  PRICE_LIST_FALLBACK_TITLE,
  PRICE_LIST_IMAGE_HEIGHT,
  PRICE_LIST_IMAGE_WIDTH,
  drawPriceListImage,
  layoutPriceListImage,
  priceListImageFileName,
} from './priceListImage';

gsap.registerPlugin(Flip);

const PLACEMENT = 'price_list_template';
const ROW_SELECTOR = '[data-pl-row]:not([data-leaving])';

type Row = { uid: string; el: HTMLElement; item: PriceListItem };

let uidSeed = 0;
const nextUid = () => `r${++uidSeed}`;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function readItem(row: HTMLElement): PriceListItem {
  const value = (selector: string) => row.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value ?? '';
  const minutes = Number(value('[data-pl-minutes]'));
  return {
    name: value('[data-pl-name]'),
    priceGbp: parsePriceGbp(value('[data-pl-price]')),
    from: row.querySelector<HTMLInputElement>('[data-pl-from]')?.checked ?? false,
    minutes: minutes > 0 ? minutes : null,
  };
}

/** Normalises one row the same way the text and image do, or null when it has no name. */
function cleanItem(item: PriceListItem): PriceListItem | null {
  return normalisePriceList({ shopName: '', footer: '', showDuration: false, items: [item] }).items[0] ?? null;
}

export type PriceListTool = { cleanup: () => void };

export function initPriceListTool(root: HTMLElement, reduced: boolean): PriceListTool | null {
  const form = root.querySelector<HTMLFormElement>('#pl-form');
  const rowsEl = root.querySelector<HTMLOListElement>('#pl-rows');
  const template = root.querySelector<HTMLTemplateElement>('#pl-row-template');
  const sheet = root.querySelector<HTMLElement>('[data-pl-sheet]');
  const addButton = root.querySelector<HTMLButtonElement>('#pl-add');
  const status = root.querySelector<HTMLElement>('[data-pl-status]');
  if (!form || !rowsEl || !template || !sheet || !addButton || !status) return null;

  const sheetTitle = sheet.querySelector<HTMLElement>('[data-pl-sheet-title]');
  const sheetList = sheet.querySelector<HTMLElement>('[data-pl-sheet-list]');
  const sheetFooter = sheet.querySelector<HTMLElement>('[data-pl-sheet-footer]');
  if (!sheetTitle || !sheetList || !sheetFooter) return null;

  const missingEl = root.querySelector<HTMLElement>('[data-pl-missing]');
  const limitEl = root.querySelector<HTMLElement>('[data-pl-limit]');
  const ring = root.querySelector<SVGCircleElement>('[data-pl-ring]');
  const progress = ring?.closest<HTMLElement>('.pl-progress') ?? null;
  const pricedEls = root.querySelectorAll<HTMLElement>('[data-pl-priced], [data-pl-dock-priced]');
  const totalEls = root.querySelectorAll<HTMLElement>('[data-pl-total], [data-pl-dock-total]');
  const themeLabel = root.querySelector<HTMLElement>('[data-pl-theme-label]');
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-pl-quick]'));
  const ringLength = ring ? Number.parseFloat(ring.style.strokeDasharray) || 94.25 : 0;

  const sheetItems = new Map<string, HTMLLIElement>();
  const disposers: (() => void)[] = [];
  let theme: PriceListTheme = getPriceListTheme(sheet.dataset.theme);
  let statusTimer = 0;

  // Server-rendered rows and sheet items are paired by position on first run.
  const serverItems = Array.from(sheetList.children) as HTMLLIElement[];
  Array.from(rowsEl.querySelectorAll<HTMLElement>('[data-pl-row]')).forEach((row, i) => {
    const uid = nextUid();
    row.dataset.plUid = uid;
    const li = serverItems[i];
    if (li) {
      li.dataset.plUid = uid;
      li.dataset.missing = 'true';
      sheetItems.set(uid, li);
    }
  });

  const readRows = (): Row[] =>
    Array.from(rowsEl.querySelectorAll<HTMLElement>(ROW_SELECTOR)).map((el) => {
      if (!el.dataset.plUid) el.dataset.plUid = nextUid();
      return { uid: el.dataset.plUid, el, item: readItem(el) };
    });

  const readOptions = (): PriceListOptions => ({
    shopName: (form.elements.namedItem('shop') as HTMLInputElement | null)?.value ?? '',
    footer: (form.elements.namedItem('footer') as HTMLInputElement | null)?.value ?? '',
    showDuration: (form.elements.namedItem('duration') as HTMLInputElement | null)?.checked ?? false,
    items: readRows().map((row) => row.item),
  });

  const setStatus = (message: string) => {
    status.textContent = message;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.textContent = '';
    }, 5000);
  };

  /* ---------- Sheet items ---------- */

  const createSheetItem = (uid: string): HTMLLIElement => {
    const li = document.createElement('li');
    li.className = 'pl-sheet__item';
    li.dataset.plUid = uid;
    const name = document.createElement('span');
    name.className = 'pl-sheet__name';
    const leader = document.createElement('span');
    leader.className = 'pl-sheet__leader';
    leader.setAttribute('aria-hidden', 'true');
    const price = document.createElement('span');
    price.className = 'pl-sheet__price';
    li.append(name, leader, price);
    return li;
  };

  const fillSheetItem = (li: HTMLLIElement, item: PriceListItem, showDuration: boolean) => {
    const name = li.querySelector<HTMLElement>('.pl-sheet__name');
    const price = li.querySelector<HTMLElement>('.pl-sheet__price');
    if (!name || !price) return;
    const time = showDuration && item.minutes !== null ? formatMinutes(item.minutes) : '';
    const nameKey = `${item.name}|${time}`;
    if (name.dataset.key !== nameKey) {
      name.dataset.key = nameKey;
      name.textContent = item.name;
      if (time) {
        const span = document.createElement('span');
        span.className = 'pl-sheet__time';
        span.textContent = time;
        name.append(' ', span);
      }
    }
    const priceText = formatItemPrice(item);
    if (price.textContent !== priceText) price.textContent = priceText;
    const wasMissing = li.dataset.missing === 'true';
    const isMissing = item.priceGbp === null;
    li.dataset.missing = String(isMissing);
    if (isMissing) price.dataset.missing = 'true';
    else delete price.dataset.missing;
    if (wasMissing && !isMissing && !reduced) {
      gsap.fromTo(price, { y: -7, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: 'back.out(2)' });
    }
  };

  const enterSheetItem = (li: HTMLLIElement) => {
    if (reduced) return;
    const leader = li.querySelector('.pl-sheet__leader');
    gsap.fromTo(li, { height: 0, autoAlpha: 0 }, { height: 'auto', autoAlpha: 1, duration: 0.38, ease: 'power3.out', clearProps: 'height' });
    if (leader) gsap.fromTo(leader, { scaleX: 0 }, { scaleX: 1, duration: 0.6, delay: 0.12, ease: 'power2.out', transformOrigin: 'left center' });
  };

  const leaveSheetItem = (li: HTMLLIElement) => {
    if (reduced) {
      li.remove();
      return;
    }
    li.dataset.leaving = 'true';
    gsap.to(li, { height: 0, marginTop: 0, autoAlpha: 0, duration: 0.28, ease: 'power2.in', onComplete: () => li.remove() });
  };

  /* ---------- Render ---------- */

  const render = () => {
    const options = readOptions();
    const rows = readRows();
    const showDuration = options.showDuration;

    const shopName = normalisePriceList(options).shopName;
    const title = shopName || PRICE_LIST_FALLBACK_TITLE;
    if (sheetTitle.textContent !== title) sheetTitle.textContent = title;
    sheetTitle.dataset.empty = String(!shopName);

    const footer = normalisePriceList(options).footer;
    sheetFooter.textContent = footer;
    sheetFooter.hidden = footer.length === 0;

    // Sheet items in form order; rows without a name have no item.
    const desired: HTMLLIElement[] = [];
    const seen = new Set<string>();
    let priced = 0;
    const missing: string[] = [];
    rows.slice(0, PRICE_LIST_MAX_ITEMS).forEach((row) => {
      const item = cleanItem(row.item);
      updateRowMeta(row, item);
      if (!item) return;
      seen.add(row.uid);
      let li = sheetItems.get(row.uid);
      const isNew = !li;
      if (!li) {
        li = createSheetItem(row.uid);
        sheetItems.set(row.uid, li);
      }
      fillSheetItem(li, item, showDuration);
      if (isNew) li.dataset.entering = 'true';
      desired.push(li);
      if (item.priceGbp === null) missing.push(item.name);
      else priced += 1;
    });

    for (const [uid, li] of sheetItems) {
      if (!seen.has(uid)) {
        sheetItems.delete(uid);
        leaveSheetItem(li);
      }
    }

    let previous: Element | null = null;
    for (const li of desired) {
      let actualPrev = li.previousElementSibling;
      while (actualPrev && actualPrev.hasAttribute('data-leaving')) actualPrev = actualPrev.previousElementSibling;
      if (!li.isConnected || actualPrev !== previous) {
        sheetList.insertBefore(li, previous ? previous.nextSibling : sheetList.firstChild);
      }
      if (li.dataset.entering) {
        delete li.dataset.entering;
        enterSheetItem(li);
      }
      previous = li;
    }

    // Progress, limit, chips.
    const total = desired.length;
    pricedEls.forEach((el) => (el.textContent = String(priced)));
    totalEls.forEach((el) => (el.textContent = String(total)));
    if (ring) ring.style.strokeDashoffset = String(ringLength * (1 - (total ? priced / total : 0)));
    if (progress) {
      const complete = total > 0 && priced === total;
      if (complete && progress.dataset.complete !== 'true' && !reduced) {
        gsap.fromTo(progress.querySelector('.pl-progress__ring'), { scale: 0.8 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
      }
      progress.dataset.complete = String(complete);
    }
    if (missingEl) {
      const show = priced > 0 && missing.length > 0;
      missingEl.hidden = !show;
      missingEl.textContent = show ? `Still to price: ${missing.join(', ')}.` : '';
    }

    const rowCount = rows.length;
    const full = rowCount >= PRICE_LIST_MAX_ITEMS;
    addButton.disabled = full;
    if (limitEl) limitEl.hidden = !full;
    const names = new Set(rows.map((row) => row.item.name.trim().toLowerCase()));
    chips.forEach((chip) => {
      const used = names.has((chip.dataset.plQuick ?? '').toLowerCase());
      const hide = used || full;
      if (chip.hidden && !hide && !reduced) gsap.fromTo(chip, { scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.3, ease: 'back.out(2)' });
      chip.hidden = hide;
    });
  };

  /** Row number, labels that name the service, and the per-hour hint. */
  const updateRowMeta = (row: Row, item: PriceListItem | null) => {
    const all = rowsEl.querySelectorAll(ROW_SELECTOR);
    const index = Array.prototype.indexOf.call(all, row.el) as number;
    const up = row.el.querySelector<HTMLButtonElement>('[data-pl-move="-1"]');
    const down = row.el.querySelector<HTMLButtonElement>('[data-pl-move="1"]');
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === all.length - 1;
    const indexEl = row.el.querySelector<HTMLElement>('[data-pl-index]');
    if (indexEl) indexEl.textContent = pad(index + 1);
    const label = item?.name || 'this service';
    const set = (selector: string, text: string) => {
      const el = row.el.querySelector<HTMLElement>(selector);
      if (el && el.getAttribute('aria-label') !== text) el.setAttribute('aria-label', text);
    };
    set('[data-pl-move="-1"]', `Move ${label} up`);
    set('[data-pl-move="1"]', `Move ${label} down`);
    set('[data-pl-remove]', `Remove ${label}`);
    const priceLabel = row.el.querySelector<HTMLElement>('[data-pl-price-label]');
    if (priceLabel) priceLabel.textContent = `Price of ${label} in pounds`;

    const rateEl = row.el.querySelector<HTMLElement>('[data-pl-rate]');
    if (rateEl) {
      const rate = item ? hourlyRateGbp(item) : null;
      const text = rate === null ? '' : `${item?.from ? 'from ' : ''}£${rate} an hour`;
      if (rateEl.textContent !== text) {
        rateEl.textContent = text;
        if (text && !reduced) gsap.fromTo(rateEl, { autoAlpha: 0, x: -4 }, { autoAlpha: 1, x: 0, duration: 0.3, ease: 'power2.out' });
      }
    }
  };

  /* ---------- Rows: add, remove, move ---------- */

  const addRow = (name = '', focus: 'name' | 'price' = 'name') => {
    if (rowsEl.querySelectorAll(ROW_SELECTOR).length >= PRICE_LIST_MAX_ITEMS) return;
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const row = fragment.querySelector<HTMLElement>('[data-pl-row]');
    if (!row) return;
    row.dataset.plUid = nextUid();
    const nameInput = row.querySelector<HTMLInputElement>('[data-pl-name]');
    if (nameInput && name) nameInput.value = name;
    rowsEl.append(row);
    if (!reduced) {
      gsap.fromTo(row, { height: 0, autoAlpha: 0, y: -6 }, { height: 'auto', autoAlpha: 1, y: 0, duration: 0.38, ease: 'power3.out', clearProps: 'height,transform' });
      row.classList.add('is-new');
      window.setTimeout(() => row.classList.remove('is-new'), 1200);
    }
    row.querySelector<HTMLInputElement>(focus === 'price' ? '[data-pl-price]' : '[data-pl-name]')?.focus({ preventScroll: true });
    row.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    render();
  };

  const removeRow = (row: HTMLElement) => {
    const list = Array.from(rowsEl.querySelectorAll<HTMLElement>(ROW_SELECTOR));
    const i = list.indexOf(row);
    const next = list[i + 1] ?? list[i - 1];
    const name = readItem(row).name.trim();
    row.dataset.leaving = 'true';
    (next?.querySelector<HTMLInputElement>('[data-pl-name]') ?? addButton).focus({ preventScroll: true });
    if (reduced) row.remove();
    else gsap.to(row, { height: 0, autoAlpha: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0, duration: 0.28, ease: 'power2.in', onComplete: () => row.remove() });
    setStatus(name ? `${name} removed.` : 'Service removed.');
    render();
  };

  const moveRow = (row: HTMLElement, direction: number, trigger: HTMLButtonElement) => {
    const list = Array.from(rowsEl.querySelectorAll<HTMLElement>(ROW_SELECTOR));
    const i = list.indexOf(row);
    const target = list[i + direction];
    if (!target) return;
    const flipTargets = [...list, ...Array.from(sheetList.children)];
    const state = reduced ? null : Flip.getState(flipTargets);
    if (direction < 0) rowsEl.insertBefore(row, target);
    else rowsEl.insertBefore(row, target.nextSibling);
    render();
    if (state) Flip.from(state, { duration: 0.42, ease: 'power3.inOut', targets: flipTargets });
    // At the top or bottom the pressed button is now disabled: keep focus on its partner.
    const partner = row.querySelector<HTMLButtonElement>(`[data-pl-move="${-direction}"]`);
    (trigger.disabled ? partner : trigger)?.focus({ preventScroll: true });
    const name = readItem(row).name.trim() || 'Service';
    setStatus(`${name} moved to position ${i + direction + 1}.`);
  };

  /* ---------- Style ---------- */

  const applyTheme = (id: string) => {
    theme = getPriceListTheme(id);
    sheet.dataset.theme = theme.id;
    sheet.setAttribute('style', priceListThemeStyle(theme));
    sheet.classList.toggle('pl-sheet--ui', theme.titleFace === 'ui');
    if (themeLabel) themeLabel.textContent = theme.label;
    if (!reduced) gsap.fromTo(sheet, { scale: 0.985 }, { scale: 1, duration: 0.5, ease: 'power3.out', clearProps: 'transform' });
  };

  /* ---------- Export ---------- */

  const doCopy = async (button: HTMLElement | null) => {
    try {
      await navigator.clipboard.writeText(buildPriceListText(readOptions()));
      setStatus('Price list copied as text.');
      root.querySelectorAll<HTMLElement>('[data-pl-action="copy"]').forEach((el) => {
        el.dataset.done = 'true';
        window.setTimeout(() => delete el.dataset.done, 2000);
      });
      trackConsentedEvent('price_list_copy', { placement: PLACEMENT });
    } catch {
      setStatus('Copy failed. Select the preview text instead.');
    }
    button?.blur?.();
  };

  const doPrint = () => {
    trackConsentedEvent('price_list_print', { placement: PLACEMENT });
    window.print();
  };

  const doImage = async (button: HTMLButtonElement | null) => {
    if (button) button.setAttribute('aria-busy', 'true');
    try {
      await Promise.all([
        document.fonts.load('400 120px "Bebas Neue"'),
        document.fonts.load('600 40px Inter'),
        document.fonts.load('700 40px Inter'),
      ]).catch(() => undefined);
      const canvas = document.createElement('canvas');
      canvas.width = PRICE_LIST_IMAGE_WIDTH;
      canvas.height = PRICE_LIST_IMAGE_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      const measure = (text: string, font: string) => {
        ctx.font = font;
        return ctx.measureText(text).width;
      };
      const options = readOptions();
      drawPriceListImage(ctx, layoutPriceListImage(options, theme, measure), theme);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('no blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = priceListImageFileName(normalisePriceList(options).shopName);
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatus('Image downloaded: 1080 × 1350 pixels.');
      trackConsentedEvent('price_list_download', { placement: PLACEMENT, theme: theme.id });
    } catch {
      setStatus('The image could not be made in this browser. Try Print or Copy as text.');
    } finally {
      button?.removeAttribute('aria-busy');
    }
  };

  /* ---------- Events ---------- */

  const onInput = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.name === 'theme') {
      // Radios fire input and change; apply the style once.
      if (event.type === 'change') applyTheme(target.value);
      return;
    }
    render();
  };

  const onRowsClick = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    const row = button?.closest<HTMLElement>('[data-pl-row]');
    if (!button || !row || row.dataset.leaving) return;
    if (button.hasAttribute('data-pl-remove')) removeRow(row);
    else if (button.dataset.plMove) moveRow(row, Number(button.dataset.plMove), button);
  };

  const onRootClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const quick = target.closest<HTMLButtonElement>('[data-pl-quick]');
    if (quick && form.contains(quick)) {
      const name = quick.dataset.plQuick ?? '';
      if (reduced) addRow(name, 'price');
      else gsap.to(quick, { scale: 0.7, autoAlpha: 0, duration: 0.16, ease: 'power2.in', onComplete: () => addRow(name, 'price') });
      return;
    }
    const action = target.closest<HTMLButtonElement>('[data-pl-action]');
    if (!action) return;
    if (action.dataset.plAction === 'print') doPrint();
    else if (action.dataset.plAction === 'copy') void doCopy(action);
    else if (action.dataset.plAction === 'image') void doImage(action);
  };

  const onAdd = () => addRow('', 'name');
  const onSubmit = (event: Event) => event.preventDefault();

  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);
  form.addEventListener('submit', onSubmit);
  rowsEl.addEventListener('click', onRowsClick);
  addButton.addEventListener('click', onAdd);
  root.addEventListener('click', onRootClick);
  render();

  disposers.push(() => {
    form.removeEventListener('input', onInput);
    form.removeEventListener('change', onInput);
    form.removeEventListener('submit', onSubmit);
    rowsEl.removeEventListener('click', onRowsClick);
    addButton.removeEventListener('click', onAdd);
    root.removeEventListener('click', onRootClick);
    window.clearTimeout(statusTimer);
  });

  return {
    cleanup: () => disposers.forEach((dispose) => dispose()),
  };
}
