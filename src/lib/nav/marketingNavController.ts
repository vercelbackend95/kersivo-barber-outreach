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
  root.querySelectorAll<HTMLElement>('[data-mnav-trigger], [data-mnav-accordion]').forEach((control) => {
    const target = control.ownerDocument.getElementById(control.getAttribute('aria-controls') ?? '');
    const childCurrent = Boolean(target?.querySelector('a[aria-current="page"]'));
    const prefixes = (control.dataset.mnavCurrentPrefix ?? '').split(/\s+/).filter(Boolean);
    const prefixCurrent = prefixes.some((prefix) => matchesPrefix(pathname, prefix));
    control.toggleAttribute('data-current', childCurrent || prefixCurrent);
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

  const closePanel = ({ returnFocus = false } = {}) => {
    clearTimers();
    if (!openTrigger) return;
    const trigger = openTrigger;
    trigger.setAttribute('aria-expanded', 'false');
    const panel = panelOf(trigger);
    if (panel) panel.hidden = true;
    openTrigger = null;
    delete root.dataset.mnavPanel;
    if (returnFocus) trigger.focus();
  };

  const openPanel = (trigger: HTMLButtonElement, byHover: boolean) => {
    clearTimers();
    if (openTrigger === trigger) {
      openedByHover = openedByHover && byHover;
      return;
    }
    closePanel();
    const panel = panelOf(trigger);
    if (!panel) return;
    trigger.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    openTrigger = trigger;
    openedByHover = byHover;
    root.dataset.mnavPanel = trigger.dataset.mnavTrigger ?? '';
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

  /* -------------------------------- Mobile hub -------------------------------- */

  const menuButton = root.querySelector<HTMLButtonElement>('[data-mnav-menu]');
  const hub = menuButton ? panelOf(menuButton) : null;
  const menuLabel = menuButton?.querySelector<HTMLElement>('[data-mnav-menu-label]') ?? null;
  let inerted: HTMLElement[] = [];

  const setPageInert = (on: boolean) => {
    if (on) {
      inerted = [...doc.body.children].filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && el !== root && !el.contains(root) && el.tagName !== 'SCRIPT' && !el.hasAttribute('inert'),
      );
      inerted.forEach((el) => el.setAttribute('inert', ''));
    } else {
      inerted.forEach((el) => el.removeAttribute('inert'));
      inerted = [];
    }
  };

  const isHubOpen = () => menuButton?.getAttribute('aria-expanded') === 'true';

  /** The hub ships as an inert <template>; build its DOM the first time it is needed. */
  const mountHub = () => {
    const template = hub?.querySelector<HTMLTemplateElement>(':scope > template[data-mnav-hub-content]');
    if (!hub || !template) return;
    hub.replaceChildren(template.content.cloneNode(true));
    sectionLinks.push(...hub.querySelectorAll<HTMLAnchorElement>('a[data-mnav-section]'));
    applyMarketingNavCurrent(root, win.location);
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
    doc.body.style.setProperty(FLOW_HEIGHT_VAR, `${root.getBoundingClientRect().height}px`);
    // Pin the header before the hub is shown: an in-flow hub would grow the page and let scroll anchoring move it.
    root.setAttribute('data-mnav-hub-open', '');
    doc.documentElement.classList.add(LOCK_CLASS);
    menuButton.setAttribute('aria-expanded', 'true');
    if (menuLabel) menuLabel.textContent = 'Close';
    hub.hidden = false;
    hub.removeAttribute('inert');
    hub.scrollTop = 0;
    setPageInert(true);
    hub.querySelector<HTMLElement>('[data-mnav-accordion], a[href]')?.focus({ preventScroll: true });
  };

  menuButton?.addEventListener('click', () => (isHubOpen() ? closeHub({ returnFocus: true }) : openHub()), { signal });

  // Delegated: hub content is mounted lazily from its template.
  hub?.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      const button = target?.closest<HTMLButtonElement>('[data-mnav-accordion]');
      if (button && hub.contains(button)) {
        const section = panelOf(button);
        if (!section) return;
        const expand = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(expand));
        section.hidden = !expand;
        return;
      }
      if (target?.closest('a[href]')) closeHub();
    },
    { signal },
  );

  desktopMedia?.addEventListener('change', (event) => event.matches && closeHub(), { signal });

  /* ------------------------------ Shared behaviour ----------------------------- */

  doc.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        if (openTrigger) closePanel({ returnFocus: true });
        else if (isHubOpen()) closeHub({ returnFocus: true });
        return;
      }

      const active = doc.activeElement;
      if (!(active instanceof HTMLElement) || !root.contains(active)) return;

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

  let scrollFrame = 0;
  const updateScrolled = () => {
    scrollFrame = 0;
    root.toggleAttribute('data-scrolled', win.scrollY > 8);
  };
  updateScrolled();
  win.addEventListener(
    'scroll',
    () => {
      if (!scrollFrame) scrollFrame = win.requestAnimationFrame(updateScrolled);
    },
    { passive: true, signal },
  );

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
    clearTimers();
    if (scrollFrame) win.cancelAnimationFrame(scrollFrame);
    sectionObserver?.disconnect();
    sectionLinks.forEach((link) => link.getAttribute('aria-current') === 'location' && link.removeAttribute('aria-current'));
    controller.abort();
    cleanups.delete(root);
    delete root.dataset.mnavBound;
  };

  doc.addEventListener('astro:before-swap', cleanup, { once: true, signal });
  root.dataset.mnavBound = 'true';
  cleanups.set(root, cleanup);
  return cleanup;
}
