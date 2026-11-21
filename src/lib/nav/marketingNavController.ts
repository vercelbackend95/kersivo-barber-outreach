/**
 * Vanilla controller for MarketingNavbar: desktop disclosure panels, the mobile navigation hub,
 * current-page state and Astro ClientRouter lifecycle. All destinations are server-rendered anchors;
 * this module only toggles visibility and state.
 */

export type MarketingNavOptions = {
  hoverOpenDelay?: number;
  hoverCloseDelay?: number;
  /** Matches when the desktop navigation (not the mobile hub) is in use. */
  desktopQuery?: string;
  /** Matches when hover intent should open panels. */
  hoverQuery?: string;
};

const LOCK_CLASS = 'mnav-locked';
const FLOW_HEIGHT_VAR = '--mnav-flow-h';
const cleanups = new WeakMap<HTMLElement, () => void>();

const normalizePath = (path: string) => (path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path || '/');

function matchesPrefix(pathname: string, prefix: string): boolean {
  const path = normalizePath(pathname);
  const base = normalizePath(prefix);
  return Boolean(base) && (path === base || path.startsWith(`${base}/`));
}

/** Re-derives aria-current from the live URL; the persisted header otherwise keeps the previous page's state. */
export function applyMarketingNavCurrent(root: HTMLElement, location: Pick<Location, 'pathname'>): void {
  const pathname = normalizePath(location.pathname);
  root.querySelectorAll<HTMLAnchorElement>('a[data-mnav-match], a[data-mnav-match-prefix]').forEach((link) => {
    const exact = link.dataset.mnavMatch ? normalizePath(link.dataset.mnavMatch) === pathname : false;
    const prefix = link.dataset.mnavMatchPrefix ?? '';
    const inSection = prefix ? matchesPrefix(pathname, prefix) : false;
    if (exact || inSection) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  root.querySelectorAll<HTMLElement>('[data-mnav-trigger], [data-mnav-tab]').forEach((control) => {
    const target = control.ownerDocument.getElementById(control.getAttribute('aria-controls') ?? '');
    const childCurrent = Boolean(target?.querySelector('a[aria-current="page"]'));
    const prefixes = (control.dataset.mnavCurrentPrefix ?? '').split(/\s+/).filter(Boolean);
    const prefixCurrent = prefixes.some((prefix) => matchesPrefix(pathname, prefix));
    control.toggleAttribute('data-current', childCurrent || prefixCurrent);
  });
  root.querySelectorAll<HTMLElement>('[data-mnav-self-hide]').forEach((cta) => {
    const target = new URL(cta.getAttribute('href') ?? '', 'https://kersivo.co.uk');
    cta.hidden = !target.hash && normalizePath(target.pathname) === pathname;
  });
}

function isFocusable(el: HTMLElement): boolean {
  if (el.closest('[hidden]') || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
  const view = el.ownerDocument.defaultView;
  if (!view) return true;
  const style = view.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function focusableIn(container: ParentNode): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(isFocusable);
}

export function initMarketingNav(root: HTMLElement, options: MarketingNavOptions = {}): () => void {
  const existing = cleanups.get(root);
  const doc = root.ownerDocument;
  const win = doc.defaultView ?? window;
  applyMarketingNavCurrent(root, win.location);
  if (existing) return existing;

  const {
    hoverOpenDelay = 120,
    hoverCloseDelay = 250,
    desktopQuery = '(min-width: 64rem)',
    hoverQuery = '(hover: hover) and (pointer: fine)',
  } = options;
  const media = (query: string) => (typeof win.matchMedia === 'function' ? win.matchMedia(query) : null);
  const desktopMedia = media(desktopQuery);
  const hoverMedia = media(hoverQuery);

  const controller = new AbortController();
  const { signal } = controller;
  const panelOf = (control: Element) => doc.getElementById(control.getAttribute('aria-controls') ?? '');

  /* ------------------------------ Desktop panels ------------------------------ */

  const triggers = [...root.querySelectorAll<HTMLButtonElement>('[data-mnav-trigger]')];
  let openTrigger: HTMLButtonElement | null = null;
  let openedByHover = false;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const clearTimers = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  };

  /* Sliding highlight behind the hovered, focused or open top-level control. */
  const indicator = root.querySelector<HTMLElement>('[data-mnav-indicator]');
  const desktopNav = indicator?.parentElement ?? null;
  const indicatorBase = () => (indicator?.offsetParent as HTMLElement | null) ?? desktopNav;
  const moveIndicator = (target: HTMLElement | null) => {
    if (!indicator || !desktopNav) return;
    const control = target ?? openTrigger;
    if (!control) {
      indicator.removeAttribute('data-visible');
      return;
    }
    const navBox = (indicatorBase() ?? desktopNav).getBoundingClientRect();
    const box = control.getBoundingClientRect();
    // Appear in place (no slide in from the previous spot); slide only between controls.
    indicator.toggleAttribute('data-instant', !indicator.hasAttribute('data-visible'));
    indicator.style.setProperty('--mnav-ind-x', `${box.left - navBox.left}px`);
    indicator.style.setProperty('--mnav-ind-w', `${box.width}px`);
    indicator.setAttribute('data-visible', '');
  };

  const closePanel = ({ returnFocus = false } = {}) => {
    clearTimers();
    if (!openTrigger) return;
    const trigger = openTrigger;
    trigger.setAttribute('aria-expanded', 'false');
    const panel = panelOf(trigger);
    if (panel) panel.hidden = true;
    openTrigger = null;
    delete root.dataset.mnavPanel;
    moveIndicator(null);
    if (returnFocus) trigger.focus();
  };

  const openPanel = (trigger: HTMLButtonElement, byHover: boolean) => {
    clearTimers();
    if (openTrigger === trigger) {
      openedByHover = openedByHover && byHover;
      return;
    }
    // Moving between open panels swaps content in place instead of replaying the entrance.
    root.toggleAttribute('data-mnav-switching', Boolean(openTrigger));
    closePanel();
    const panel = panelOf(trigger);
    if (!panel) return;
    trigger.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    openTrigger = trigger;
    openedByHover = byHover;
    root.dataset.mnavPanel = trigger.dataset.mnavTrigger ?? '';
    moveIndicator(trigger);
  };

  triggers.forEach((trigger) => {
    const item = trigger.closest('li') ?? trigger.parentElement!;
    trigger.addEventListener(
      'click',
      () => {
        if (openTrigger === trigger && !openedByHover) closePanel();
        else openPanel(trigger, false);
      },
      { signal },
    );
    item.addEventListener(
      'pointerenter',
      (event) => {
        if ((event as PointerEvent).pointerType === 'touch' || !hoverMedia?.matches) return;
        clearTimeout(closeTimer);
        if (openTrigger === trigger) return;
        clearTimeout(openTimer);
        openTimer = setTimeout(() => openPanel(trigger, true), openTrigger ? 0 : hoverOpenDelay);
      },
      { signal },
    );
    item.addEventListener(
      'pointerleave',
      (event) => {
        if ((event as PointerEvent).pointerType === 'touch' || !hoverMedia?.matches) return;
        clearTimeout(openTimer);
        if (openTrigger === trigger && openedByHover) {
          closeTimer = setTimeout(() => closePanel(), hoverCloseDelay);
        }
      },
      { signal },
    );
    item.addEventListener(
      'focusout',
      (event) => {
        const next = (event as FocusEvent).relatedTarget;
        if (openTrigger === trigger && next instanceof Node && !item.contains(next)) closePanel();
      },
      { signal },
    );
    panelOf(trigger)?.addEventListener(
      'click',
      (event) => {
        if ((event.target as Element | null)?.closest('a[href]')) closePanel();
      },
      { signal },
    );
  });

  doc.addEventListener(
    'pointerdown',
    (event) => {
      if (openTrigger && event.target instanceof Node && !openTrigger.closest('li')?.contains(event.target)) closePanel();
    },
    { signal },
  );

  root.querySelectorAll<HTMLElement>('.mnav__desktop .mnav__trigger, .mnav__desktop .mnav__link').forEach((control) => {
    control.addEventListener('pointerenter', () => hoverMedia?.matches && moveIndicator(control), { signal });
    control.addEventListener('focus', () => moveIndicator(control), { signal });
    control.addEventListener('blur', () => moveIndicator(null), { signal });
  });
  desktopNav?.addEventListener('pointerleave', () => moveIndicator(null), { signal });

  /* -------------------------------- Mobile hub -------------------------------- */

  const menuButton = root.querySelector<HTMLButtonElement>('[data-mnav-menu]');
  const hub = menuButton ? panelOf(menuButton) : null;
  const menuLabel = menuButton?.querySelector<HTMLElement>('[data-mnav-menu-label]') ?? null;
  let inerted: HTMLElement[] = [];

  const setPageInert = (on: boolean) => {
    if (on) {
      inerted = [...doc.body.children].filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement &&
          el !== root &&
          !el.contains(root) &&
          el.tagName !== 'SCRIPT' &&
          !el.hasAttribute('inert') &&
          // The Safari toolbar probes must stay hit-testable (see SafariEdgeProbes.astro).
          !el.hasAttribute('data-edge-probe'),
      );
      inerted.forEach((el) => el.setAttribute('inert', ''));
    } else {
      inerted.forEach((el) => el.removeAttribute('inert'));
      inerted = [];
    }
  };

  const isHubOpen = () => menuButton?.getAttribute('aria-expanded') === 'true';

  const tabsOf = () => (hub ? [...hub.querySelectorAll<HTMLButtonElement>('[data-mnav-tab]')] : []);

  /** Slides between tabs; `instant` places it without motion (opening the hub). */
  const placeTabThumb = (tab: HTMLButtonElement | null, { instant = false } = {}) => {
    const thumb = hub?.querySelector<HTMLElement>('[data-mnav-tab-thumb]');
    if (!thumb || !tab) return;
    if (instant) thumb.setAttribute('data-instant', '');
    thumb.style.setProperty('--mnav-thumb-x', `${tab.offsetLeft}px`);
    thumb.style.setProperty('--mnav-thumb-w', `${tab.offsetWidth}px`);
    if (instant) {
      void thumb.offsetWidth;
      thumb.removeAttribute('data-instant');
    }
  };

  /** WAI-ARIA tabs: one tab stop; arrow keys move and select. */
  const selectTab = (tab: HTMLButtonElement, { focus = false } = {}) => {
    tabsOf().forEach((other) => {
      const on = other === tab;
      other.setAttribute('aria-selected', String(on));
      if (on) other.removeAttribute('tabindex');
      else other.setAttribute('tabindex', '-1');
      const panel = panelOf(other);
      if (panel) panel.hidden = !on;
    });
    placeTabThumb(tab);
    if (focus) tab.focus();
  };

  /** The hub ships as an inert <template>; build its DOM the first time it is needed. */
  const mountHub = () => {
    const template = hub?.querySelector<HTMLTemplateElement>(':scope > template[data-mnav-hub-content]');
    if (!hub || !template) return;
    hub.replaceChildren(template.content.cloneNode(true));
    sectionLinks.push(...hub.querySelectorAll<HTMLAnchorElement>('a[data-mnav-section]'));
    applyMarketingNavCurrent(root, win.location);
    // The header persists across pages: open on the tab for the page shown now, not the one it was rendered on.
    const tabs = tabsOf();
    const initial =
      tabs.find((tab) => tab.hasAttribute('data-current')) ?? tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    if (initial) selectTab(initial);
  };

  const closeHub = ({ returnFocus = false } = {}) => {
    if (!menuButton || !hub || !isHubOpen()) return;
    menuButton.setAttribute('aria-expanded', 'false');
    if (menuLabel) menuLabel.textContent = 'Menu';
    hub.hidden = true;
    hub.setAttribute('inert', '');
    root.removeAttribute('data-mnav-hub-open');
    doc.documentElement.classList.remove(LOCK_CLASS);
    doc.body.style.removeProperty(FLOW_HEIGHT_VAR);
    setPageInert(false);
    if (returnFocus) menuButton.focus();
  };

  const openHub = () => {
    if (!menuButton || !hub || isHubOpen()) return;
    mountHub();
    closePanel();
    // The header's in-flow height includes its top margin (the gap above the pill).
    const marginTop = Number.parseFloat(doc.defaultView?.getComputedStyle(root).marginTop ?? '') || 0;
    doc.body.style.setProperty(FLOW_HEIGHT_VAR, `${root.getBoundingClientRect().height + marginTop}px`);
    // Pin the header before the hub is shown: an in-flow hub would grow the page and let scroll anchoring move it.
    root.setAttribute('data-mnav-hub-open', '');
    doc.documentElement.classList.add(LOCK_CLASS);
    menuButton.setAttribute('aria-expanded', 'true');
    if (menuLabel) menuLabel.textContent = 'Close';
    hub.hidden = false;
    hub.removeAttribute('inert');
    hub.scrollTop = 0;
    setPageInert(true);
    placeTabThumb(tabsOf().find((tab) => tab.getAttribute('aria-selected') === 'true') ?? null, { instant: true });
    hub.querySelector<HTMLElement>('[data-mnav-finder-open], a[href]')?.focus({ preventScroll: true });
  };

  menuButton?.addEventListener('click', () => (isHubOpen() ? closeHub({ returnFocus: true }) : openHub()), { signal });

  // Delegated: hub content is mounted lazily from its template.
  hub?.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      const tab = target?.closest<HTMLButtonElement>('[data-mnav-tab]');
      if (tab && hub.contains(tab)) {
        selectTab(tab);
        return;
      }
      if (target?.closest('a[href]')) closeHub();
    },
    { signal },
  );

  desktopMedia?.addEventListener('change', (event) => event.matches && closeHub(), { signal });

  /* ---------------------------------- Finder ---------------------------------- */

  const finder = root.querySelector<HTMLDialogElement>('[data-mnav-finder]');
  let finderInput: HTMLInputElement | null = null;
  let finderOptions: HTMLAnchorElement[] = [];
  let activeOption: HTMLAnchorElement | null = null;
  let finderOpener: HTMLElement | null = null;

  /** Visible results in display order: rows whose title matches are lifted above description-only matches. */
  const visibleOptions = () =>
    finderOptions
      .filter((option) => !option.parentElement?.hidden)
      .sort((a, b) => Number(a.parentElement?.style.order || 0) - Number(b.parentElement?.style.order || 0));

  const setActiveOption = (option: HTMLAnchorElement | null) => {
    activeOption?.setAttribute('aria-selected', 'false');
    activeOption = option;
    if (option) {
      option.setAttribute('aria-selected', 'true');
      finderInput?.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView?.({ block: 'nearest' });
    } else {
      finderInput?.removeAttribute('aria-activedescendant');
    }
  };

  const filterFinder = () => {
    if (!finder || !finderInput) return;
    const words = finderInput.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    finderOptions.forEach((option) => {
      const row = option.parentElement;
      const terms = row?.dataset.terms ?? '';
      const title = row?.dataset.title ?? '';
      const match = words.every((word) => terms.includes(word));
      if (row) {
        row.hidden = !match;
        row.style.order = words.length && !words.every((word) => title.includes(word)) ? '1' : '';
      }
      if (match) shown += 1;
    });
    const empty = finder.querySelector<HTMLElement>('[data-mnav-finder-empty]');
    if (empty) empty.hidden = shown > 0;
    const status = finder.querySelector<HTMLElement>('[data-mnav-finder-status]');
    if (status) status.textContent = words.length ? `${shown} ${shown === 1 ? 'result' : 'results'}` : '';
    setActiveOption(words.length ? (visibleOptions()[0] ?? null) : null);
  };

  const closeFinder = ({ returnFocus = true } = {}) => {
    if (!finder?.open) return;
    if (!returnFocus) finderOpener = null;
    finder.close();
  };

  /** Mounts the results on first use; after a page swap the persisted header already has them, so only bind. */
  const mountFinder = () => {
    if (!finder) return;
    const template = finder.querySelector<HTMLTemplateElement>(':scope > template[data-mnav-finder-content]');
    if (template) finder.replaceChildren(template.content.cloneNode(true));
    finderInput = finder.querySelector<HTMLInputElement>('[data-mnav-finder-input]');
    if (!finderInput) return;
    finderOptions = [...finder.querySelectorAll<HTMLAnchorElement>('[role="option"]')];
    finderInput?.addEventListener('input', filterFinder, { signal });
    finderInput?.addEventListener(
      'keydown',
      (event) => {
        const options = visibleOptions();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (!options.length) return;
          const index = activeOption ? options.indexOf(activeOption) : -1;
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          setActiveOption(options[(index + delta + options.length) % options.length]);
        } else if (event.key === 'Enter') {
          const target = activeOption ?? (finderInput?.value.trim() ? options[0] : null);
          if (!target) return;
          event.preventDefault();
          target.click();
        }
      },
      { signal },
    );
  };

  if (finder) {
    // Delegated: content mounts lazily. A click on the backdrop lands on the <dialog> itself.
    finder.addEventListener(
      'click',
      (event) => {
        const target = event.target as Element | null;
        if (target === finder || target?.closest('[data-mnav-finder-close]')) closeFinder();
        else if (target?.closest('a[href]')) closeFinder({ returnFocus: false });
      },
      { signal },
    );
    finder.addEventListener(
      'close',
      () => {
        doc.documentElement.classList.remove('mnav-finder-open');
        finderOpener?.focus({ preventScroll: true });
        finderOpener = null;
      },
      { signal },
    );
  }

  const openFinder = (opener: HTMLElement | null) => {
    if (!finder || finder.open || typeof finder.showModal !== 'function') return;
    if (!finderInput) mountFinder();
    closePanel();
    const fromHub = isHubOpen();
    if (fromHub) closeHub();
    finderOpener = fromHub ? menuButton : opener;
    if (finderInput) finderInput.value = '';
    filterFinder();
    doc.documentElement.classList.add('mnav-finder-open');
    finder.showModal();
    finderInput?.focus();
  };

  // Delegated: the hub's search button is mounted lazily.
  root.addEventListener(
    'click',
    (event) => {
      const opener = (event.target as Element | null)?.closest<HTMLElement>('[data-mnav-finder-open]');
      if (opener && root.contains(opener)) openFinder(opener);
    },
    { signal },
  );

  // "/" or Ctrl/Cmd+K opens the finder from anywhere, except "/" while typing in a field.
  doc.addEventListener(
    'keydown',
    (event) => {
      if (!finder || finder.open || event.defaultPrevented || event.altKey) return;
      const shortcut = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
      const slash = event.key === '/' && !event.metaKey && !event.ctrlKey;
      if (!shortcut && !slash) return;
      const active = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
      const typing = Boolean(active?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
      if (slash && typing) return;
      event.preventDefault();
      openFinder(active && active !== doc.body ? active : null);
    },
    { signal },
  );

  /* ------------------------------ Shared behaviour ----------------------------- */

  doc.addEventListener(
    'keydown',
    (event) => {
      if (finder?.open) return;
      if (event.key === 'Escape') {
        if (openTrigger) closePanel({ returnFocus: true });
        else if (isHubOpen()) closeHub({ returnFocus: true });
        return;
      }

      const active = doc.activeElement;
      if (!(active instanceof HTMLElement) || !root.contains(active)) return;

      if (isHubOpen() && active.matches('[data-mnav-tab]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const tabs = tabsOf();
        const index = tabs.indexOf(active as HTMLButtonElement);
        const next =
          event.key === 'Home'
            ? tabs[0]
            : event.key === 'End'
              ? tabs[tabs.length - 1]
              : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        if (next) selectTab(next, { focus: true });
        return;
      }

      if (event.key === 'Tab' && isHubOpen()) {
        const items = focusableIn(root);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (isHubOpen() || desktopMedia?.matches === false) return;
      const onTrigger = active.matches('[data-mnav-trigger]');
      if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && onTrigger) {
        event.preventDefault();
        const index = triggers.indexOf(active as HTMLButtonElement);
        if (index < 0) return;
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const next = triggers[(index + delta + triggers.length) % triggers.length];
        next.focus();
        openPanel(next, false);
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const trigger = onTrigger ? (active as HTMLButtonElement) : openTrigger;
      if (!trigger || !triggers.includes(trigger)) return;
      const panel = panelOf(trigger);
      if (!panel) return;
      if (onTrigger) {
        if (event.key !== 'ArrowDown') return;
        event.preventDefault();
        openPanel(trigger, false);
        focusableIn(panel)[0]?.focus();
        return;
      }
      if (!panel.contains(active)) return;
      const items = focusableIn(panel);
      const index = items.indexOf(active);
      if (index < 0 || items.length === 0) return;
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + delta + items.length) % items.length]?.focus();
    },
    { signal },
  );

  // The bar slides away while scrolling down and returns on any scroll up. It stays while the menu or a
  // panel is open, while it holds focus, and near the top of the page.
  const HIDE_AFTER = 96;
  const SCROLL_SLOP = 6;
  let scrollFrame = 0;
  let lastScrollY = win.scrollY;
  const updateScrolled = () => {
    scrollFrame = 0;
    const y = win.scrollY;
    root.toggleAttribute('data-scrolled', y > 8);
    const delta = y - lastScrollY;
    if (Math.abs(delta) < SCROLL_SLOP && y > HIDE_AFTER) return;
    lastScrollY = y;
    const keep = y <= HIDE_AFTER || isHubOpen() || root.hasAttribute('data-mnav-panel') || root.contains(doc.activeElement);
    root.toggleAttribute('data-mnav-hidden', !keep && delta > 0);
  };
  updateScrolled();
  win.addEventListener(
    'scroll',
    () => {
      if (!scrollFrame) scrollFrame = win.requestAnimationFrame(updateScrolled);
    },
    { passive: true, signal },
  );
  // Keyboard focus entering the bar brings it back.
  root.addEventListener('focusin', () => root.removeAttribute('data-mnav-hidden'), { signal });

  let sectionObserver: IntersectionObserver | null = null;
  const sectionLinks = [...root.querySelectorAll<HTMLAnchorElement>('a[data-mnav-section]')];
  if (normalizePath(win.location.pathname) === '/' && sectionLinks.length && typeof win.IntersectionObserver === 'function') {
    const inView = new Set<string>();
    sectionObserver = new win.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? inView.add(entry.target.id) : inView.delete(entry.target.id)));
        sectionLinks.forEach((link) => {
          if (inView.has(link.dataset.mnavSection ?? '')) link.setAttribute('aria-current', 'location');
          else if (link.getAttribute('aria-current') === 'location') link.removeAttribute('aria-current');
        });
      },
      { rootMargin: '-35% 0px -55% 0px' },
    );
    new Set(sectionLinks.map((link) => link.dataset.mnavSection)).forEach((id) => {
      const section = id ? doc.getElementById(id) : null;
      if (section) sectionObserver!.observe(section);
    });
  }

  const cleanup = () => {
    closePanel();
    closeHub();
    closeFinder({ returnFocus: false });
    clearTimers();
    if (scrollFrame) win.cancelAnimationFrame(scrollFrame);
    sectionObserver?.disconnect();
    sectionLinks.forEach((link) => link.getAttribute('aria-current') === 'location' && link.removeAttribute('aria-current'));
    controller.abort();
    cleanups.delete(root);
    delete root.dataset.mnavBound;
  };

  // Close menus when the click lands, not when the next page arrives.
  doc.addEventListener(
    'astro:before-preparation',
    () => {
      closePanel();
      closeHub();
      closeFinder({ returnFocus: false });
    },
    { signal },
  );
  doc.addEventListener('astro:before-swap', cleanup, { once: true, signal });
  root.dataset.mnavBound = 'true';
  cleanups.set(root, cleanup);
  return cleanup;
}
