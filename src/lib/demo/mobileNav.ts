export type MobileNavState = 'closed' | 'opening' | 'open' | 'closing';

export const DESKTOP_NAV_QUERY = '(min-width: 1024px)';
export const NAV_OPEN_MS = 720;
export const NAV_CLOSE_MS = 320;
export const CART_OPEN_REQUEST_EVENT = 'kersivo:cart-open-request';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function prefersReducedMotion(win: Window = window): boolean {
  try {
    return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
    if (el.closest('[hidden]')) return false;
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    if (style && (style.visibility === 'hidden' || style.display === 'none')) return false;
    return true;
  });
}

export function overlayTopFromHeader(header: HTMLElement): number {
  return Math.max(0, Math.round(header.getBoundingClientRect().bottom));
}

type ScrollSnapshot = {
  position: string;
  top: string;
  width: string;
  left: string;
  right: string;
};

export function createScrollLock(doc: Document, win: Window) {
  let locked = false;
  let scrollY = 0;
  let previous: ScrollSnapshot | null = null;

  return {
    lock() {
      if (locked) return;
      const body = doc.body;
      scrollY = win.scrollY || doc.documentElement.scrollTop || 0;
      previous = {
        position: body.style.position,
        top: body.style.top,
        width: body.style.width,
        left: body.style.left,
        right: body.style.right,
      };
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      locked = true;
    },
    unlock() {
      if (!locked) return;
      const body = doc.body;
      if (previous) {
        body.style.position = previous.position;
        body.style.top = previous.top;
        body.style.width = previous.width;
        body.style.left = previous.left;
        body.style.right = previous.right;
      }
      locked = false;
      previous = null;
      win.scrollTo(0, scrollY);
    },
    isLocked() {
      return locked;
    },
    getScrollY() {
      return scrollY;
    },
  };
}

export type BindMobileNavOptions = {
  header: HTMLElement;
  toggle: HTMLButtonElement;
  overlay: HTMLElement;
  reducedMotion?: () => boolean;
  desktopQuery?: string;
  openMs?: number;
  closeMs?: number;
};

export function bindMobileNav(options: BindMobileNavOptions): () => void {
  const {
    header,
    toggle,
    overlay,
    reducedMotion = () => prefersReducedMotion(header.ownerDocument.defaultView ?? window),
    desktopQuery = DESKTOP_NAV_QUERY,
    openMs = NAV_OPEN_MS,
    closeMs = NAV_CLOSE_MS,
  } = options;

  const doc = header.ownerDocument;
  const win = doc.defaultView ?? window;
  const label = toggle.querySelector('.bl-sr-only');
  const lock = createScrollLock(doc, win);
  let state: MobileNavState = 'closed';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let restoreFocus: HTMLElement | null = null;

  const setState = (next: MobileNavState) => {
    state = next;
    header.dataset.blNavState = next;
  };

  const setExpanded = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Close navigation menu' : 'Open navigation menu';
  };

  const setBackgroundInert = (inert: boolean) => {
    for (const selector of ['.bl-main', '.bl-footer']) {
      const el = doc.querySelector(selector);
      if (el instanceof HTMLElement && 'inert' in el) el.inert = inert;
    }
  };

  const syncOverlayTop = () => {
    overlay.style.setProperty('--bl-nav-layer-top', `${overlayTopFromHeader(header)}px`);
  };

  const clearTimer = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  };

  const focusInitial = () => {
    const active = overlay.querySelector<HTMLElement>('[aria-current="page"]');
    const firstLink = overlay.querySelector<HTMLElement>('nav a[href]');
    (active ?? firstLink ?? toggle).focus();
  };

  const finishClose = (returnFocus: boolean) => {
    clearTimer();
    overlay.hidden = true;
    setState('closed');
    setExpanded(false);
    setBackgroundInert(false);
    lock.unlock();
    if (returnFocus) toggle.focus();
  };

  const close = (mode: 'animate' | 'immediate', returnFocus: boolean) => {
    if (state === 'closed') {
      if (returnFocus) toggle.focus();
      return;
    }

    clearTimer();
    setExpanded(false);
    const instant = mode === 'immediate' || reducedMotion();
    if (instant) {
      finishClose(returnFocus);
      return;
    }

    setState('closing');
    timer = setTimeout(() => finishClose(returnFocus), closeMs);
  };

  const finishOpen = () => {
    timer = null;
    setState('open');
  };

  const open = () => {
    if (state === 'open' || state === 'opening') return;

    clearTimer();
    restoreFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : toggle;
    overlay.hidden = false;
    setExpanded(true);
    syncOverlayTop();
    lock.lock();
    setBackgroundInert(true);
    overlay.getBoundingClientRect();

    const instant = reducedMotion();
    if (instant) {
      setState('open');
      focusInitial();
      return;
    }

    setState('opening');
    focusInitial();
    timer = setTimeout(finishOpen, openMs);
  };

  const toggleOpen = () => {
    if (state === 'open' || state === 'opening') close('animate', true);
    else open();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (state === 'closed') return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close('animate', true);
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = getFocusable(header).filter((el) => overlay.contains(el) || el === toggle);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = doc.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onOverlayClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const bag = target.closest('[data-bl-nav-bag]');
    if (bag) {
      event.preventDefault();
      close('immediate', false);
      win.dispatchEvent(new CustomEvent(CART_OPEN_REQUEST_EVENT));
      return;
    }

    const link = target.closest('a[href]');
    if (link && overlay.contains(link)) {
      close('immediate', false);
    }
  };

  const onResize = () => {
    if (state === 'closed') return;
    if (win.matchMedia(desktopQuery).matches) {
      close('immediate', false);
      return;
    }
    syncOverlayTop();
  };

  const onPopState = () => close('immediate', false);

  const onRouteChange = () => close('immediate', false);

  toggle.addEventListener('click', toggleOpen);
  overlay.addEventListener('click', onOverlayClick);
  doc.addEventListener('keydown', onKeyDown);
  win.addEventListener('resize', onResize);
  win.addEventListener('popstate', onPopState);
  doc.addEventListener('astro:before-preparation', onRouteChange);
  doc.addEventListener('astro:after-swap', onRouteChange);
  doc.addEventListener('astro:page-load', onRouteChange);

  setState('closed');
  setExpanded(false);
  overlay.hidden = true;

  return () => {
    clearTimer();
    toggle.removeEventListener('click', toggleOpen);
    overlay.removeEventListener('click', onOverlayClick);
    doc.removeEventListener('keydown', onKeyDown);
    win.removeEventListener('resize', onResize);
    win.removeEventListener('popstate', onPopState);
    doc.removeEventListener('astro:before-preparation', onRouteChange);
    doc.removeEventListener('astro:after-swap', onRouteChange);
    doc.removeEventListener('astro:page-load', onRouteChange);
    if (state !== 'closed') finishClose(false);
    void restoreFocus;
  };
}
