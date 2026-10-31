import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import { detectPlatform, workLinkLooksValid, workLinkPreviewText, normaliseWorkLink } from './workLinkNormalise';
import {
  WORK_LINK_VALUE_MAX,
  WORK_PICKER_COPY,
  WORK_UNDO_MS,
  isWorkPlatformId,
  workPlatformById,
  type WorkPlatformId,
} from './workPlatforms';

type PendingUndo = { id: WorkPlatformId; value: string; timeout: number };

function platformFromEl(el: Element | null): WorkPlatformId | null {
  const id = el instanceof HTMLElement ? el.dataset.platform : undefined;
  return id && isWorkPlatformId(id) ? id : null;
}

function tileFor(root: HTMLElement, id: WorkPlatformId): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`button.fp-platform[data-platform="${id}"]`);
}

function inputFor(root: HTMLElement, id: WorkPlatformId): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>(`#fp-work-${id}`);
}

function rowFor(root: HTMLElement, id: WorkPlatformId): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-platform-row="${id}"]`);
}

function prefersReducedMotion(): boolean {
  return Boolean(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function announce(root: HTMLElement, message: string) {
  const live = root.querySelector<HTMLElement>('[data-platform-live]');
  if (!live) return;
  live.textContent = '';
  live.textContent = message;
}

function setSmartStatus(root: HTMLElement, message: string, tone: 'ok' | 'hint' | '') {
  const status = root.querySelector<HTMLElement>('[data-smart-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function updateCounter(root: HTMLElement) {
  const countEl = root.querySelector<HTMLElement>('[data-platform-count]');
  if (!countEl) return;
  const n = root.querySelectorAll('[data-platform-row]').length;
  countEl.textContent = n ? WORK_PICKER_COPY.addedCount(n) : '';
  countEl.classList.toggle('is-empty', n === 0);
}

function updateRowChrome(root: HTMLElement, id: WorkPlatformId) {
  const platform = workPlatformById(id);
  const input = inputFor(root, id);
  const hint = root.querySelector<HTMLElement>(`#fp-hint-${id}`);
  const tick = root.querySelector<HTMLElement>(`#fp-tick-${id}`);
  const preview = root.querySelector<HTMLElement>(`#fp-preview-${id}`);
  const check = root.querySelector<HTMLAnchorElement>(`#fp-check-${id}`);
  if (!input) return;

  const raw = input.value;
  const trimmed = raw.trim();
  const valid = workLinkLooksValid(id, raw);
  const parsed = trimmed ? normaliseWorkLink(id, raw) : null;
  const previewText = trimmed ? workLinkPreviewText(id, raw) : '';

  if (hint) {
    const show = Boolean(trimmed) && !valid;
    hint.hidden = !show;
    hint.textContent = show ? platform.hint : '';
    if (show) input.setAttribute('aria-describedby', hint.id);
    else input.removeAttribute('aria-describedby');
  }

  if (tick) tick.hidden = !(trimmed && valid);

  if (preview) {
    preview.hidden = !previewText;
    preview.textContent = previewText;
  }

  if (check) {
    if (parsed?.url) {
      check.hidden = false;
      check.href = parsed.url;
    } else {
      check.hidden = true;
      check.removeAttribute('href');
    }
  }
}

function setPressed(tile: HTMLButtonElement, pressed: boolean) {
  tile.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  tile.classList.toggle('fp-platform--selected', pressed);
}

function revealRow(row: HTMLElement) {
  if (prefersReducedMotion()) {
    row.classList.add('is-in');
    return;
  }
  requestAnimationFrame(() => {
    row.classList.add('is-in');
  });
}

function createInputRow(root: HTMLElement, tile: HTMLButtonElement, id: WorkPlatformId): HTMLInputElement | null {
  const platform = workPlatformById(id);
  const list = root.querySelector<HTMLElement>('[data-platform-inputs]');
  if (!list) return null;

  const existing = inputFor(root, id);
  if (existing) return existing;

  const row = document.createElement('div');
  row.className = 'fp-platform-input';
  row.dataset.platform = id;
  row.dataset.platformRow = id;

  const inner = document.createElement('div');
  inner.className = 'fp-platform-input__inner';

  const label = document.createElement('label');
  label.className = 'free-preview-form__label';
  label.htmlFor = `fp-work-${id}`;
  label.textContent = platform.inputLabel;

  const control = document.createElement('span');
  control.className = 'free-preview-form__control';

  const mark = tile.querySelector('.fp-platform__mark[data-has-mark="true"]');
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
  input.maxLength = WORK_LINK_VALUE_MAX;
  input.addEventListener('input', () => updateRowChrome(root, id));
  input.addEventListener('blur', () => updateRowChrome(root, id));

  const tick = document.createElement('span');
  tick.className = 'fp-platform-input__tick';
  tick.id = `fp-tick-${id}`;
  tick.hidden = true;
  tick.setAttribute('aria-hidden', 'true');
  tick.textContent = '✓';

  control.append(input, tick);

  const meta = document.createElement('p');
  meta.className = 'fp-platform-input__meta';

  const preview = document.createElement('span');
  preview.className = 'fp-platform-input__preview';
  preview.id = `fp-preview-${id}`;
  preview.hidden = true;

  const check = document.createElement('a');
  check.className = 'fp-platform-input__check';
  check.id = `fp-check-${id}`;
  check.textContent = WORK_PICKER_COPY.check;
  check.target = '_blank';
  check.rel = 'noopener noreferrer';
  check.hidden = true;

  meta.append(preview, check);

  const hint = document.createElement('p');
  hint.className = 'fp-platform-input__hint';
  hint.id = `fp-hint-${id}`;
  hint.hidden = true;

  inner.append(label, control, meta, hint);
  row.append(inner);
  list.append(row);
  revealRow(row);
  updateRowChrome(root, id);
  return input;
}

function removeInputRow(root: HTMLElement, id: WorkPlatformId, onGone?: () => void) {
  const row = rowFor(root, id);
  if (!row) {
    onGone?.();
    return;
  }

  const finish = () => {
    row.remove();
    updateCounter(root);
    onGone?.();
  };

  if (prefersReducedMotion() || !row.classList.contains('is-in')) {
    finish();
    return;
  }

  row.classList.remove('is-in');
  window.setTimeout(finish, 180);
}

function hideUndo(root: HTMLElement, pending: { current: PendingUndo | null }) {
  if (pending.current) {
    window.clearTimeout(pending.current.timeout);
    pending.current = null;
  }
  const undo = root.querySelector<HTMLElement>('[data-platform-undo]');
  if (undo) undo.hidden = true;
}

function showUndo(root: HTMLElement, pending: { current: PendingUndo | null }, id: WorkPlatformId, value: string) {
  if (pending.current) window.clearTimeout(pending.current.timeout);
  const undo = root.querySelector<HTMLElement>('[data-platform-undo]');
  const message = root.querySelector<HTMLElement>('[data-undo-message]');
  const name = workPlatformById(id).name;
  if (message) message.textContent = WORK_PICKER_COPY.removedUndo(name);
  if (undo) undo.hidden = false;
  announce(root, WORK_PICKER_COPY.removedUndo(name));
  pending.current = {
    id,
    value,
    timeout: window.setTimeout(() => {
      pending.current = null;
      if (undo) undo.hidden = true;
    }, WORK_UNDO_MS),
  };
}

function selectPlatform(
  root: HTMLElement,
  id: WorkPlatformId,
  options?: { value?: string; focus?: boolean; track?: boolean; autodetect?: boolean },
): HTMLInputElement | null {
  const tile = tileFor(root, id);
  if (!tile) return null;
  setPressed(tile, true);
  const input = createInputRow(root, tile, id);
  if (options?.value !== undefined && input) {
    input.value = options.value;
    updateRowChrome(root, id);
  }
  updateCounter(root);
  if (options?.focus !== false && input) input.focus();
  if (options?.track !== false) {
    trackConsentedEvent(FUNNEL_EVENTS.preview_work_platform_selected, { platform: id });
  }
  if (options?.autodetect) {
    trackConsentedEvent(FUNNEL_EVENTS.preview_work_platform_autodetected, { platform: id });
  }
  return input;
}

function applySmartPaste(root: HTMLElement, pending: { current: PendingUndo | null }, raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return;
  const detected = detectPlatform(trimmed);
  if (!detected) {
    setSmartStatus(root, WORK_PICKER_COPY.smartUnknown, 'hint');
    announce(root, WORK_PICKER_COPY.smartUnknown);
    return;
  }

  if (pending.current?.id === detected) hideUndo(root, pending);

  const name = workPlatformById(detected).name;
  const confirmation = WORK_PICKER_COPY.addedTo(name);
  selectPlatform(root, detected, { value: trimmed, focus: true, track: true, autodetect: true });
  const smart = root.querySelector<HTMLInputElement>('[data-smart-paste]');
  if (smart) smart.value = '';
  setSmartStatus(root, confirmation, 'ok');
  announce(root, confirmation);
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

  const pending: { current: PendingUndo | null } = { current: null };

  const restoreUndo = () => {
    const current = pending.current;
    if (!current) return;
    hideUndo(root, pending);
    const input = selectPlatform(root, current.id, { value: current.value, focus: true, track: false });
    input?.focus();
  };

  picker.querySelector<HTMLButtonElement>('[data-undo]')?.addEventListener('click', restoreUndo);

  picker.querySelectorAll<HTMLButtonElement>('button.fp-platform').forEach((tile) => {
    tile.addEventListener('click', () => {
      const id = platformFromEl(tile);
      if (!id) return;
      const selected = tile.getAttribute('aria-pressed') === 'true';

      if (pending.current?.id === id) {
        restoreUndo();
        return;
      }

      if (selected) {
        const value = inputFor(root, id)?.value.trim() ?? '';
        setPressed(tile, false);
        const focusWasInside = Boolean(rowFor(root, id)?.contains(document.activeElement));
        removeInputRow(root, id, () => {
          if (focusWasInside || document.activeElement === document.body) tile.focus();
        });
        tile.focus();
        if (value) showUndo(root, pending, id, value);
        return;
      }

      hideUndo(root, pending);
      selectPlatform(root, id);
    });
  });

  const smart = picker.querySelector<HTMLInputElement>('[data-smart-paste]');
  smart?.addEventListener('paste', () => {
    window.setTimeout(() => applySmartPaste(root, pending, smart.value), 0);
  });
  smart?.addEventListener('blur', () => applySmartPaste(root, pending, smart.value));
  smart?.addEventListener('input', () => {
    if (smart.value.trim()) return;
    setSmartStatus(root, '', '');
  });
}
