import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { trackConsentedEvent } from '@/lib/consent/events';
import { dedupeWorkLinks, parseLinkInput, splitLinkInput, workLinkPreviewText } from './workLinkNormalise';
import {
  SMART_LINK_COPY,
  WORK_LINKS_MAX,
  WORK_UNDO_MS,
  workPlatformName,
  type WorkLink,
} from './workPlatforms';

export type SmartLinks = {
  input: HTMLInputElement;
  links: () => WorkLink[];
  /** Adds whatever is still typed in the input, if it is valid. */
  flush: () => void;
  /** Moves focus to the input, or to the add-another button when the input is collapsed. */
  focus: () => void;
};

type SmartLinkOptions = { onNext: () => void; onChange: () => void };

function chipElement(link: WorkLink): HTMLLIElement {
  const name = workPlatformName(link.platform);
  const chip = document.createElement('li');
  chip.className = 'fp-link-chip';

  const inner = document.createElement('div');
  inner.className = 'fp-link-chip__inner';

  const platform = document.createElement('span');
  platform.className = 'fp-link-chip__platform';
  platform.textContent = name;

  const url = document.createElement('span');
  url.className = 'fp-link-chip__url';
  url.textContent = workLinkPreviewText(link.platform, link.url ?? link.value);

  const check = document.createElement('a');
  check.className = 'fp-link-chip__check';
  check.href = link.url ?? '';
  check.target = '_blank';
  check.rel = 'noopener noreferrer';
  check.textContent = SMART_LINK_COPY.check;
  check.setAttribute('aria-label', SMART_LINK_COPY.checkLabel(name));

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'fp-link-chip__remove';
  remove.dataset.linkRemove = '';
  remove.setAttribute('aria-label', SMART_LINK_COPY.remove(name));
  remove.textContent = '×';

  inner.append(platform, url, check, remove);
  chip.append(inner);
  return chip;
}

/** The single link field on /free-preview: chips for each link, collapsing behind an add-another button. */
export function initSmartLinks(root: HTMLElement, options: SmartLinkOptions): SmartLinks | null {
  const input = root.querySelector<HTMLInputElement>('[data-smart-paste]');
  const chips = root.querySelector<HTMLElement>('[data-link-chips]');
  const entry = root.querySelector<HTMLElement>('[data-link-entry]');
  const addAnother = root.querySelector<HTMLButtonElement>('[data-link-add]');
  const supported = root.querySelector<HTMLElement>('[data-link-supported]');
  const hint = root.querySelector<HTMLElement>('[data-link-hint]');
  const max = root.querySelector<HTMLElement>('[data-link-max]');
  const live = root.querySelector<HTMLElement>('[data-link-live]');
  const undo = root.querySelector<HTMLElement>('[data-link-undo]');
  const undoButton = root.querySelector<HTMLButtonElement>('[data-link-undo-button]');
  if (!input || !chips || !entry || !addAnother || !supported || !hint || !max || !live || !undo || !undoButton) {
    return null;
  }

  let links: WorkLink[] = [];
  let entryOpen = true;
  let pendingUndo: { link: WorkLink; index: number; timeout: number } | null = null;

  const render = () => {
    const atMax = links.length >= WORK_LINKS_MAX;
    if (!links.length) entryOpen = true;
    chips.hidden = !links.length;
    entry.hidden = atMax || !entryOpen;
    addAnother.hidden = atMax || entryOpen;
    supported.hidden = links.length > 0;
    max.hidden = !atMax;
  };

  const setHint = (message: string) => {
    hint.textContent = message;
    hint.hidden = !message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };

  const clearUndo = () => {
    if (pendingUndo) window.clearTimeout(pendingUndo.timeout);
    pendingUndo = null;
    undo.hidden = true;
  };

  /** Returns whether the text is dealt with: at least one usable link, even if all were already added. */
  const addFromText = (text: string): boolean => {
    const parsed = splitLinkInput(text)
      .map(parseLinkInput)
      .filter((link): link is WorkLink => Boolean(link));
    if (!parsed.length) {
      setHint(SMART_LINK_COPY.invalid);
      live.textContent = SMART_LINK_COPY.invalid;
      return false;
    }

    const combined = dedupeWorkLinks([...links, ...parsed]).slice(0, WORK_LINKS_MAX);
    const added = combined.slice(links.length);
    links = combined;
    added.forEach((link) => {
      chips.append(chipElement(link));
      trackConsentedEvent(FUNNEL_EVENTS.fp_link_added, { platform: link.platform });
    });
    if (added.length) {
      clearUndo();
      live.textContent = added.map((link) => SMART_LINK_COPY.added(workPlatformName(link.platform))).join('. ');
      options.onChange();
    }
    input.value = '';
    setHint('');
    entryOpen = false;
    render();
    return true;
  };

  // The input is about to disappear, so focus needs somewhere to go.
  const moveFocusFromEntry = () => {
    if (addAnother.hidden) options.onNext();
    else addAnother.focus();
  };

  input.addEventListener('paste', (event) => {
    const pasted = event.clipboardData?.getData('text') ?? '';
    if (!pasted.trim()) return;
    event.preventDefault();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const combined = `${input.value.slice(0, start)}${pasted}${input.value.slice(end)}`;
    if (addFromText(combined)) moveFocusFromEntry();
    else input.value = combined.trim();
  });

  input.addEventListener('input', (event) => {
    setHint('');
    const serverError = root.querySelector<HTMLElement>('[data-error-for="links"]');
    if (serverError) serverError.textContent = '';
    // Some Android keyboards paste through the suggestion bar without a paste event.
    if ((event as InputEvent).inputType === 'insertFromPaste' && addFromText(input.value)) moveFocusFromEntry();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!input.value.trim() || addFromText(input.value)) options.onNext();
  });

  input.addEventListener('blur', () => {
    if (input.value.trim()) {
      addFromText(input.value);
      return;
    }
    if (links.length) {
      entryOpen = false;
      render();
    }
  });

  addAnother.addEventListener('click', () => {
    entryOpen = true;
    render();
    input.focus();
  });

  chips.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLElement>('[data-link-remove]');
    const chip = button?.closest('li');
    if (!chip) return;
    const index = [...chips.children].indexOf(chip);
    const [link] = links.splice(index, 1);
    chip.remove();
    clearUndo();
    pendingUndo = { link, index, timeout: window.setTimeout(clearUndo, WORK_UNDO_MS) };
    undo.hidden = false;
    live.textContent = SMART_LINK_COPY.removed;
    render();

    const neighbour = chips.children[index] ?? chips.children[index - 1];
    if (neighbour) neighbour.querySelector<HTMLElement>('[data-link-remove]')?.focus();
    else input.focus();
  });

  undoButton.addEventListener('click', () => {
    if (!pendingUndo) return;
    const { link, index } = pendingUndo;
    clearUndo();
    links.splice(index, 0, link);
    const chip = chipElement(link);
    chips.insertBefore(chip, chips.children[index] ?? null);
    live.textContent = SMART_LINK_COPY.added(workPlatformName(link.platform));
    input.value = '';
    setHint('');
    entryOpen = false;
    render();
    chip.querySelector<HTMLElement>('[data-link-remove]')?.focus();
  });

  render();

  return {
    input,
    links: () => [...links],
    flush: () => {
      if (input.value.trim()) addFromText(input.value);
    },
    focus: () => {
      if (!entry.hidden) input.focus();
      else if (!addAnother.hidden) addAnother.focus();
      else options.onNext();
    },
  };
}
