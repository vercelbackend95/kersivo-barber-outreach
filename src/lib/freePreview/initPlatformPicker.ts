import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import { workLinkLooksValid } from './workLinkNormalise';
import { isWorkPlatformId, workPlatformById, type WorkPlatformId } from './workPlatforms';

function platformFromEl(el: Element | null): WorkPlatformId | null {
  const id = el instanceof HTMLElement ? el.dataset.platform : undefined;
  return id && isWorkPlatformId(id) ? id : null;
}

function inputFor(root: HTMLElement, id: WorkPlatformId): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>(`#fp-work-${id}`);
}

function hintFor(root: HTMLElement, id: WorkPlatformId): HTMLElement | null {
  return root.querySelector<HTMLElement>(`#fp-hint-${id}`);
}

function updateHint(root: HTMLElement, id: WorkPlatformId) {
  const platform = workPlatformById(id);
  const input = inputFor(root, id);
  const hint = hintFor(root, id);
  if (!input || !hint) return;
  const show = Boolean(input.value.trim()) && !workLinkLooksValid(id, input.value);
  hint.hidden = !show;
  hint.textContent = show ? platform.hint : '';
  if (show) input.setAttribute('aria-describedby', hint.id);
  else input.removeAttribute('aria-describedby');
}

function createInputRow(root: HTMLElement, tile: HTMLButtonElement, id: WorkPlatformId): HTMLElement {
  const platform = workPlatformById(id);
  const list = root.querySelector<HTMLElement>('[data-platform-inputs]');
  if (!list) return tile;

  const row = document.createElement('div');
  row.className = 'fp-platform-input';
  row.dataset.platform = id;
  row.dataset.platformRow = id;

  const label = document.createElement('label');
  label.className = 'free-preview-form__label';
  label.htmlFor = `fp-work-${id}`;
  label.textContent = platform.inputLabel;

  const control = document.createElement('span');
  control.className = 'free-preview-form__control';

  const mark = tile.querySelector('.fp-platform__mark');
  if (mark) {
    const clone = mark.cloneNode(true) as HTMLElement;
    clone.classList.add('fp-platform-input__mark');
    clone.setAttribute('aria-hidden', 'true');
    control.append(clone);
  }

  const input = document.createElement('input');
  input.id = `fp-work-${id}`;
  input.type = 'text';
  input.inputMode = platform.inputMode;
  if (platform.inputMode === 'url') input.setAttribute('autocomplete', 'url');
  input.placeholder = platform.placeholder;
  input.maxLength = 500;
  input.addEventListener('input', () => updateHint(root, id));
  input.addEventListener('blur', () => updateHint(root, id));

  const hint = document.createElement('p');
  hint.className = 'fp-platform-input__hint';
  hint.id = `fp-hint-${id}`;
  hint.hidden = true;

  control.append(input);
  row.append(label, control, hint);
  list.append(row);
  return input;
}

function removeInputRow(root: HTMLElement, tile: HTMLButtonElement, id: WorkPlatformId) {
  const row = root.querySelector<HTMLElement>(`[data-platform-row="${id}"]`);
  const active = document.activeElement;
  const focusWasInside = Boolean(row && active && row.contains(active));
  row?.remove();
  if (focusWasInside) tile.focus();
}

function setPressed(tile: HTMLButtonElement, pressed: boolean) {
  tile.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  tile.classList.toggle('fp-platform--selected', pressed);
}

export function collectWorkLinks(root: HTMLElement): Array<{ platform: WorkPlatformId; value: string }> {
  const links: Array<{ platform: WorkPlatformId; value: string }> = [];
  root.querySelectorAll<HTMLElement>('[data-platform-row]').forEach((row) => {
    const id = platformFromEl(row);
    if (!id) return;
    const value = inputFor(root, id)?.value.trim() ?? '';
    if (!value) return;
    links.push({ platform: id, value });
  });
  return links;
}

export function initPlatformPicker(root: HTMLElement) {
  const picker = root.querySelector<HTMLElement>('[data-platform-picker]');
  if (!picker || picker.dataset.fpPickerReady === 'true') return;
  picker.dataset.fpPickerReady = 'true';

  picker.querySelectorAll<HTMLButtonElement>('button.fp-platform').forEach((tile) => {
    tile.addEventListener('click', () => {
      const id = platformFromEl(tile);
      if (!id) return;
      const selected = tile.getAttribute('aria-pressed') === 'true';
      if (selected) {
        setPressed(tile, false);
        removeInputRow(root, tile, id);
        return;
      }
      setPressed(tile, true);
      const input = createInputRow(root, tile, id);
      if (input instanceof HTMLInputElement) input.focus();
      trackConsentedEvent(FUNNEL_EVENTS.preview_work_platform_selected, { platform: id });
    });
  });
}
