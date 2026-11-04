/**
 * Deep links into Overview › Add to your website (`?item=`): scroll a card into view, focus its heading and
 * outline it briefly. Shared by HubYourShop (photos, logo, files) and WebsiteSetupFlow (business, hours).
 * The fade is CSS (`.is-hub-add-target`), with no transition under prefers-reduced-motion.
 */

/** How long `?item=` keeps its card highlighted. */
export const HUB_ADD_HIGHLIGHT_MS = 2400;

/**
 * Scrolls a card to the top of the app body (respecting its scroll-margin-top) and moves focus to its heading.
 * Only the app body scrolls: scrollIntoView would also scroll the app window's own box and push its title bar out
 * of view. Outside the hub it falls back to scrollIntoView.
 */
export function scrollToHubAddTarget(node: HTMLElement) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
  const scroller = node.closest<HTMLElement>('.admin-hub-app__body');
  if (scroller && typeof scroller.scrollTo === 'function') {
    const margin = parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
    const box = scroller.getBoundingClientRect();
    // The app window may still be scaling in: convert on-screen distance to layout pixels.
    const scale = box.height > 0 && scroller.offsetHeight > 0 ? scroller.offsetHeight / box.height : 1;
    const top = scroller.scrollTop + (node.getBoundingClientRect().top - box.top) * scale - margin;
    scroller.scrollTo({ top: Math.max(0, top), behavior });
  } else if (typeof node.scrollIntoView === 'function') {
    node.scrollIntoView({ block: 'start', behavior });
  }
  const heading = node.querySelector('h2');
  if (heading instanceof HTMLElement) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

/** Scroll, focus and highlight the card with this id. Returns a cleanup, or null when the card is not on the page. */
export function highlightHubAddTarget(id: string): (() => void) | null {
  const node = document.getElementById(id);
  if (!node) return null;
  node.classList.add('is-hub-add-target');
  scrollToHubAddTarget(node);
  const timer = window.setTimeout(() => node.classList.remove('is-hub-add-target'), HUB_ADD_HIGHLIGHT_MS);
  return () => {
    window.clearTimeout(timer);
    node.classList.remove('is-hub-add-target');
  };
}
