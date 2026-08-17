import { isDemoNavActive } from '@/lib/demo/nav';
import {
  ROUTE_COVER_MS,
  ROUTE_REVEAL_MS,
  ROUTE_SAFETY_MS,
  bindRouteTransition as bindSharedRouteTransition,
  focusRouteContent,
  isCurrentPathNavigation,
  isModifiedNavigationClick,
  isSameDocumentHashNavigation,
  prefersReducedMotion,
  shouldCoverTransition as shouldCoverShared,
  shouldIgnoreAnchorNavigation as shouldIgnoreShared,
  waitMs,
  type BindRouteTransitionOptions,
  type NavigationType,
  type RouteTransitionPhase,
} from '@/lib/navigation/routeTransition';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';

export type { RouteTransitionPhase };
export type DemoNavigationType = NavigationType;

export {
  ROUTE_COVER_MS,
  ROUTE_REVEAL_MS,
  ROUTE_SAFETY_MS,
  focusRouteContent,
  isCurrentPathNavigation,
  isModifiedNavigationClick,
  isSameDocumentHashNavigation,
  prefersReducedMotion,
  waitMs,
};

export const NAV_ACTIVE_SELECTORS =
  '.bl-nav-link, .bl-nav-index-link, .bl-header-cta, .bl-header-book, [data-bl-nav-book]';

export function isBlacklineCustomerPath(pathname: string): boolean {
  return getRouteFamily(pathname) === 'demo';
}

export function shouldIgnoreAnchorNavigation(
  href: string,
  current: { href: string; origin: string; pathname: string },
  extras: { target?: string; download?: boolean; reload?: boolean } = {},
): boolean {
  return shouldIgnoreShared(href, current, { ...extras, family: 'demo' });
}

export function shouldCoverTransition(input: {
  from: URL;
  to: URL;
  navigationType: DemoNavigationType;
  reducedMotion: boolean;
}): boolean {
  return shouldCoverShared({ ...input, family: 'demo' });
}

export function clearPageMotionAttributes(el: HTMLElement): void {
  for (const attr of [...el.attributes]) {
    if (/^data-bl-.+-(motion|instant)$/.test(attr.name)) {
      el.removeAttribute(attr.name);
    }
  }
}

export function syncDemoNavActive(header: HTMLElement, pathname: string): void {
  header.querySelectorAll<HTMLAnchorElement>(NAV_ACTIVE_SELECTORS).forEach((link) => {
    const raw = link.getAttribute('href');
    if (!raw) return;
    let hrefPath = raw;
    try {
      hrefPath = new URL(raw, 'https://blackline.local').pathname;
    } catch {
      hrefPath = raw.split('#')[0] ?? raw;
    }
    const active = isDemoNavActive(pathname, hrefPath);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');

    const copy = link.querySelector('.bl-nav-index-copy');
    if (!(copy instanceof HTMLElement)) return;
    const current = copy.querySelector('.bl-nav-index-current');
    if (active && !current) {
      const mark = header.ownerDocument.createElement('span');
      mark.className = 'bl-nav-index-current';
      mark.textContent = 'Current';
      copy.appendChild(mark);
    } else if (!active && current) {
      current.remove();
    }
  });
}

export function bindRouteTransition(
  options: Pick<BindRouteTransitionOptions, 'veil' | 'reducedMotion' | 'coverMs' | 'revealMs' | 'safetyMs'>,
): () => void {
  return bindSharedRouteTransition({
    ...options,
    variant: 'themed-demo',
    mainSelector: '.bl-main',
    boundDataset: 'blRouteBound',
    phaseDataset: 'blRoutePhase',
    onBeforeSwap: (event, doc) => {
      clearPageMotionAttributes(doc.documentElement);
      const nextDoc = (event as { newDocument?: Document }).newDocument;
      if (nextDoc?.documentElement) clearPageMotionAttributes(nextDoc.documentElement);
    },
    onAfterSwap: (doc) => {
      clearPageMotionAttributes(doc.documentElement);
      const header = doc.querySelector<HTMLElement>('[data-bl-header]');
      if (header) syncDemoNavActive(header, doc.defaultView?.location.pathname ?? '/');
    },
  });
}
