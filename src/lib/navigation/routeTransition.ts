import { familyFromVariant, getRouteFamily, isSameRouteFamily, type RouteTransitionVariant } from './routeFamilies';

export type RouteTransitionPhase = 'idle' | 'covering' | 'navigating' | 'revealing';
export type NavigationType = 'push' | 'replace' | 'traverse' | string;

export const ROUTE_COVER_MS = 140;
export const ROUTE_REVEAL_MS = 220;
export const ROUTE_SAFETY_MS = 10000;
export const ROUTE_PENDING_DELAY_MS = 250;
export const ROUTE_PENDING_FINISH_MS = 220;

export const VARIANT_TIMING: Record<
  Extract<RouteTransitionVariant, 'marketing' | 'flow' | 'themed-demo'>,
  { coverMs: number; revealMs: number }
> = {
  marketing: { coverMs: 120, revealMs: 200 },
  flow: { coverMs: 80, revealMs: 180 },
  'themed-demo': { coverMs: ROUTE_COVER_MS, revealMs: ROUTE_REVEAL_MS },
};

type PrepLike = {
  from: URL;
  to: URL;
  navigationType: NavigationType;
  loader: () => Promise<void>;
  signal?: AbortSignal;
  formData?: FormData;
};

export function prefersReducedMotion(win: Window = window): boolean {
  try {
    return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

export function isModifiedNavigationClick(event: {
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): boolean {
  return Boolean(
    (event.button && event.button !== 0) ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey,
  );
}

export function isSameDocumentHashNavigation(from: URL, to: URL): boolean {
  return from.pathname === to.pathname && from.search === to.search && from.hash !== to.hash;
}

export function isCurrentPathNavigation(from: URL, to: URL): boolean {
  return from.pathname === to.pathname && from.search === to.search;
}

export function shouldIgnoreAnchorNavigation(
  href: string,
  current: { href: string; origin: string; pathname: string },
  extras: { target?: string; download?: boolean; reload?: boolean; family?: ReturnType<typeof getRouteFamily> } = {},
): boolean {
  if (extras.reload || extras.download) return true;
  if (extras.target && extras.target !== '' && extras.target !== '_self') return true;

  let next: URL;
  try {
    next = new URL(href, current.href);
  } catch {
    return true;
  }

  const protocol = next.protocol.toLowerCase();
  if (protocol === 'mailto:' || protocol === 'tel:') return true;
  if (next.origin !== current.origin) return true;

  const family = extras.family ?? getRouteFamily(current.pathname);
  if (getRouteFamily(next.pathname) !== family) return true;
  if (isSameDocumentHashNavigation(new URL(current.href), next)) return true;
  if (next.pathname === current.pathname && next.search === new URL(current.href).search && !next.hash) {
    return true;
  }
  return false;
}

export function shouldCoverTransition(input: {
  from: URL;
  to: URL;
  navigationType: NavigationType;
  reducedMotion: boolean;
  family?: ReturnType<typeof getRouteFamily>;
}): boolean {
  if (input.reducedMotion) return false;
  if (input.navigationType === 'traverse') return false;
  const family = input.family ?? getRouteFamily(input.from.pathname);
  if (getRouteFamily(input.from.pathname) !== family || getRouteFamily(input.to.pathname) !== family) {
    return false;
  }
  if (!isSameRouteFamily(input.from.pathname, input.to.pathname)) return false;
  if (isCurrentPathNavigation(input.from, input.to)) return false;
  return true;
}

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function focusRouteContent(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const active = doc.activeElement;
  if (active instanceof HTMLElement && active !== doc.body && root.contains(active)) return;
  const hash = doc.defaultView?.location.hash.slice(1);
  const hashTarget = hash ? doc.getElementById(decodeURIComponent(hash)) : null;
  const heading = root.querySelector<HTMLElement>('h1');
  const target = hashTarget ?? heading ?? root;
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
}

export function markCrossFamilyReloadLinks(root: ParentNode, current: { href: string; origin: string; pathname: string }): void {
  const family = getRouteFamily(current.pathname);
  root.querySelectorAll('a[href]').forEach((node) => {
    if (!(node instanceof HTMLAnchorElement)) return;
    if (shouldIgnoreAnchorNavigation(node.getAttribute('href') || '', current, {
      target: node.getAttribute('target') || undefined,
      download: node.hasAttribute('download'),
      reload: node.hasAttribute('data-astro-reload'),
      family,
    })) {
      if (node.origin && node.origin !== current.origin) return;
      const href = node.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      try {
        const next = new URL(href, current.href);
        if (next.origin === current.origin && getRouteFamily(next.pathname) !== family) {
          // A different family has a different layout and head, so it needs a real page load.
          // No hover prefetch either: those targets include sessions, checkout and API routes.
          node.setAttribute('data-astro-reload', '');
          node.setAttribute('data-astro-prefetch', 'false');
        }
      } catch {
        /* ignore */
      }
    }
  });
}

function asPrepEvent(event: Event): PrepLike | null {
  const candidate = event as Event & Partial<PrepLike>;
  if (!(candidate.from instanceof URL) || !(candidate.to instanceof URL)) return null;
  if (typeof candidate.loader !== 'function') return null;
  return candidate as PrepLike;
}

export type BindRouteTransitionOptions = {
  veil: HTMLElement;
  pending?: HTMLElement | null;
  variant?: Extract<RouteTransitionVariant, 'marketing' | 'flow' | 'themed-demo'>;
  mainSelector?: string;
  boundDataset?: string;
  phaseDataset?: string;
  reducedMotion?: () => boolean;
  coverMs?: number;
  revealMs?: number;
  safetyMs?: number;
  pendingDelayMs?: number;
  onBeforeSwap?: (event: Event, doc: Document) => void;
  onAfterSwap?: (doc: Document) => void;
};

export function bindRouteTransition(options: BindRouteTransitionOptions): () => void {
  const variant = options.variant ?? 'themed-demo';
  const timing = VARIANT_TIMING[variant];
  const {
    veil,
    pending = null,
    reducedMotion = () => prefersReducedMotion(veil.ownerDocument.defaultView ?? window),
    coverMs = timing.coverMs,
    revealMs = timing.revealMs,
    safetyMs = ROUTE_SAFETY_MS,
    pendingDelayMs = ROUTE_PENDING_DELAY_MS,
    mainSelector = variant === 'themed-demo' ? '.bl-main' : '.ks-main',
    boundDataset = variant === 'themed-demo' ? 'blRouteBound' : 'ksRouteBound',
    phaseDataset = variant === 'themed-demo' ? 'blRoutePhase' : 'ksRoutePhase',
    onBeforeSwap,
    onAfterSwap,
  } = options;

  const family = familyFromVariant(variant);
  if (veil.dataset[boundDataset] === 'true') {
    return () => undefined;
  }
  veil.dataset[boundDataset] = 'true';

  const doc = veil.ownerDocument;
  let generation = 0;
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingFinishTimer: ReturnType<typeof setTimeout> | null = null;
  let navigating = false;
  let focusAfterLoad = false;
  let phase: RouteTransitionPhase = (veil.dataset[phaseDataset] as RouteTransitionPhase) || 'idle';

  const getMain = () => doc.querySelector<HTMLElement>(mainSelector);

  const clearPendingFinish = () => {
    if (!pendingFinishTimer) return;
    clearTimeout(pendingFinishTimer);
    pendingFinishTimer = null;
  };

  const hidePending = () => {
    if (!pending) return;
    clearPendingFinish();
    pending.hidden = true;
    pending.removeAttribute('data-active');
    pending.removeAttribute('data-done');
    pending.style.removeProperty('transform');
  };

  const showPending = () => {
    if (!pending) return;
    hidePending();
    pending.hidden = false;
    pending.setAttribute('data-active', '');
  };

  /** Runs on from wherever the bar has got to, up to 100%, then fades out. A bar that never showed stays hidden. */
  const finishPending = () => {
    if (!pending || !pending.hasAttribute('data-active') || reducedMotion()) {
      hidePending();
      return;
    }
    const view = doc.defaultView;
    const current = view ? view.getComputedStyle(pending).transform : 'none';
    pending.removeAttribute('data-active');
    pending.style.transform = current;
    void pending.offsetWidth;
    pending.setAttribute('data-done', '');
    pending.style.transform = 'scaleX(1)';
    pendingFinishTimer = setTimeout(hidePending, ROUTE_PENDING_FINISH_MS);
  };

  const clearPendingTimer = () => {
    if (!pendingTimer) return;
    clearTimeout(pendingTimer);
    pendingTimer = null;
  };

  const setPhase = (next: RouteTransitionPhase) => {
    phase = next;
    veil.dataset[phaseDataset] = next;
    if (next === 'idle') {
      veil.style.removeProperty('will-change');
      clearPendingTimer();
    } else {
      veil.style.willChange = 'opacity';
    }
  };

  const clearSafety = () => {
    if (!safetyTimer) return;
    clearTimeout(safetyTimer);
    safetyTimer = null;
  };

  const resetIdle = () => {
    generation += 1;
    navigating = false;
    clearSafety();
    clearPendingTimer();
    hidePending();
    setPhase('idle');
  };

  const armSafety = (gen: number) => {
    clearSafety();
    safetyTimer = setTimeout(() => {
      if (generation === gen) resetIdle();
    }, safetyMs);
  };

  const armPending = (gen: number) => {
    clearPendingTimer();
    if (!pending) return;
    pendingTimer = setTimeout(() => {
      if (generation === gen && navigating) showPending();
    }, pendingDelayMs);
  };

  const beginCover = (gen: number) => {
    setPhase('covering');
    return waitMs(coverMs).then(() => {
      if (generation !== gen) return;
      if (phase === 'covering') setPhase('navigating');
    });
  };

  const beginReveal = (gen: number) => {
    if (generation !== gen) return;
    setPhase('revealing');
    void waitMs(revealMs).then(() => {
      if (generation !== gen) return;
      clearSafety();
      setPhase('idle');
    });
  };

  const currentLocation = () => {
    const win = doc.defaultView;
    return {
      href: win?.location.href ?? 'http://localhost/',
      origin: win?.location.origin ?? 'http://localhost',
      pathname: win?.location.pathname ?? '/',
    };
  };

  const onBeforePreparation = (event: Event) => {
    const prep = asPrepEvent(event);
    if (!prep) return;

    // Links get data-astro-reload up front; this catches the rest (islands rendered later, a click before the script ran).
    // The router turns a cancelled preparation into a normal page load.
    if (
      variant === 'marketing' &&
      prep.navigationType !== 'traverse' &&
      !prep.formData &&
      getRouteFamily(prep.to.pathname) !== family
    ) {
      event.preventDefault();
      return;
    }

    const cover = shouldCoverTransition({
      from: prep.from,
      to: prep.to,
      navigationType: prep.navigationType,
      reducedMotion: reducedMotion(),
      family: family ?? undefined,
    });

    const gen = ++generation;
    navigating = true;
    focusAfterLoad = prep.navigationType !== 'traverse';
    const originalLoader = prep.loader.bind(prep);
    prep.loader = async () => {
      armSafety(gen);
      armPending(gen);
      const covered = cover ? beginCover(gen) : Promise.resolve();
      try {
        await Promise.all([originalLoader(), covered]);
      } catch (error) {
        if (generation === gen) resetIdle();
        throw error;
      }
    };

    prep.signal?.addEventListener('abort', () => {
      if (generation === gen) resetIdle();
    });
  };

  const onBeforeSwapEvent = (event: Event) => {
    markCrossFamilyReloadLinks(doc, currentLocation());
    onBeforeSwap?.(event, doc);
  };

  const onAfterSwapEvent = () => {
    markCrossFamilyReloadLinks(doc, currentLocation());
    onAfterSwap?.(doc);
    navigating = false;
    clearPendingTimer();
    finishPending();
    if (phase === 'covering' || phase === 'navigating') {
      beginReveal(generation);
    } else if (phase === 'idle') {
      clearSafety();
    }
  };

  const onPageLoad = () => {
    markCrossFamilyReloadLinks(doc, currentLocation());
    if (phase === 'covering' || phase === 'navigating') beginReveal(generation);
    if (!focusAfterLoad) return;
    focusAfterLoad = false;
    const main = getMain();
    if (main) focusRouteContent(main);
  };

  // Back to a page frozen mid-navigation (bfcache) must not come back covered.
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) resetIdle();
  };

  doc.addEventListener('astro:before-preparation', onBeforePreparation);
  doc.addEventListener('astro:before-swap', onBeforeSwapEvent);
  doc.addEventListener('astro:after-swap', onAfterSwapEvent);
  doc.addEventListener('astro:page-load', onPageLoad);
  doc.defaultView?.addEventListener('pageshow', onPageShow);

  setPhase('idle');
  markCrossFamilyReloadLinks(doc, currentLocation());

  return () => {
    veil.dataset[boundDataset] = 'false';
    doc.removeEventListener('astro:before-preparation', onBeforePreparation);
    doc.removeEventListener('astro:before-swap', onBeforeSwapEvent);
    doc.removeEventListener('astro:after-swap', onAfterSwapEvent);
    doc.removeEventListener('astro:page-load', onPageLoad);
    doc.defaultView?.removeEventListener('pageshow', onPageShow);
    resetIdle();
  };
}
