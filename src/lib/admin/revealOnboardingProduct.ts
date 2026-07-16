const HIGHLIGHT_MS = 9000;
const PRODUCT_COACHMARK_TEXT = 'Add this product to your test basket';

export type RevealOnboardingProductInput = {
  id: string;
  name: string;
  category: string;
  /** When true and no `.shop-page`, navigate to listing with `?highlight=1`. */
  allowNavigateFromPdp?: boolean;
};

export type RevealOnboardingProductCallbacks = {
  onPainted?: (productName: string) => void;
  onMissing?: () => void;
  onNavigating?: () => void;
};

let pendingRevealTimer: number | null = null;
let paintTimer: number | null = null;
let highlightTimer: number | null = null;
let atcClearHandler: ((event: Event) => void) | null = null;
let atcClearTarget: HTMLButtonElement | null = null;

function findProductItem(productId: string): HTMLElement | null {
  return document.querySelector(
    `[data-product-item][data-product-id="${CSS.escape(productId)}"]`,
  );
}

function resolveShopCategory(category: string): string {
  const root = document.querySelector('.shop-page');
  if (!root) return category || 'ALL';
  const filterButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-category-filter]'),
  );
  if (filterButtons.length === 0) return 'ALL';
  const hasCategoryChip = filterButtons.some(
    (button) => button.getAttribute('data-category-filter') === category,
  );
  return hasCategoryChip ? category : 'ALL';
}

function applyCategoryFilterDom(resolvedCategory: string) {
  const root = document.querySelector('.shop-page');
  if (!root) return;

  const filterButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-category-filter]'),
  );

  for (const item of root.querySelectorAll<HTMLElement>('[data-product-item]')) {
    const productCategory = item.getAttribute('data-product-category') || 'STYLING';
    item.hidden = !(resolvedCategory === 'ALL' || productCategory === resolvedCategory);
  }

  for (const button of filterButtons) {
    const isActive = button.getAttribute('data-category-filter') === resolvedCategory;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  }

  root.setAttribute('data-active-category', resolvedCategory);

  const emptyEl = root.querySelector('.shop-empty-filter');
  if (emptyEl) {
    const anyVisible = [...root.querySelectorAll<HTMLElement>('[data-product-item]')].some(
      (item) => !item.hidden,
    );
    emptyEl.classList.toggle('is-visible', !anyVisible);
  }
}

/** DOM filter first (reliable), then event for URL sync when the page script is ready. */
export function applyCategoryForProduct(category: string) {
  const root = document.querySelector('.shop-page');
  if (!root) return;

  const resolvedCategory = resolveShopCategory(category);
  applyCategoryFilterDom(resolvedCategory);

  if (root.getAttribute('data-shop-filter-ready') === '1') {
    window.dispatchEvent(
      new CustomEvent('kersivo:shop-set-category', {
        detail: { category: resolvedCategory },
      }),
    );
  }
}

function getStickyNavbarOffset(): number {
  const nav = document.querySelector('.navbar17') as HTMLElement | null;
  const height = nav?.getBoundingClientRect().height ?? 0;
  return height + 12;
}

function scrollRevealTargetIntoView(item: HTMLElement) {
  const target =
    item.querySelector<HTMLElement>('[data-add-to-cart]') ??
    item.querySelector<HTMLElement>('.shop-card-actions') ??
    item;
  const navOffset = getStickyNavbarOffset();
  const rect = target.getBoundingClientRect();
  const paddingBottom = 20;
  const desiredTop = Math.max(
    navOffset + 12,
    window.innerHeight - rect.height - paddingBottom,
  );
  const top = window.scrollY + rect.top - desiredTop;
  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
}

function removeProductCoachmarks() {
  document.querySelectorAll('.retail-onboarding-coachmark').forEach((node) => node.remove());
}

function placeProductCoachmark(anchor: HTMLElement) {
  removeProductCoachmarks();
  const mark = document.createElement('div');
  mark.className = 'retail-onboarding-coachmark';
  mark.setAttribute('role', 'status');
  mark.textContent = PRODUCT_COACHMARK_TEXT;

  const actions = anchor.closest('.shop-card-actions') ?? anchor.parentElement;
  if (actions) {
    actions.classList.add('shop-card-actions--coachmark-host');
    actions.appendChild(mark);
  } else {
    anchor.insertAdjacentElement('afterend', mark);
  }

  requestAnimationFrame(() => {
    const rect = mark.getBoundingClientRect();
    if (rect.right > window.innerWidth - 12) {
      mark.classList.add('retail-onboarding-coachmark--flip');
    }
    if (rect.bottom > window.innerHeight - 12) {
      mark.classList.add('retail-onboarding-coachmark--above');
    }
  });

  return mark;
}

function detachAtcClearHandler() {
  if (atcClearTarget && atcClearHandler) {
    atcClearTarget.removeEventListener('click', atcClearHandler);
  }
  atcClearTarget = null;
  atcClearHandler = null;
}

export function clearOnboardingProductHighlight() {
  document.querySelectorAll('.shop-card--onboarding-highlight').forEach((el) => {
    el.classList.remove('shop-card--onboarding-highlight');
  });
  document.querySelectorAll('.retail-atc--onboarding-focus').forEach((el) => {
    el.classList.remove('retail-atc--onboarding-focus');
  });
  document.querySelectorAll('.retail-your-product-badge').forEach((el) => el.remove());
  document.querySelectorAll('.shop-card-actions--coachmark-host').forEach((el) => {
    el.classList.remove('shop-card-actions--coachmark-host');
  });
  removeProductCoachmarks();
  detachAtcClearHandler();
}

function clearHighlightQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('highlight')) return;
  url.searchParams.delete('highlight');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function paintProductReveal(item: HTMLElement, productName: string) {
  clearOnboardingProductHighlight();

  const card = item.querySelector('.shop-card') as HTMLElement | null;
  const atc = item.querySelector<HTMLButtonElement>('[data-add-to-cart]');

  if (card) {
    card.classList.add('shop-card--onboarding-highlight');
    const badge = document.createElement('span');
    badge.className = 'retail-your-product-badge';
    badge.textContent = 'YOUR PRODUCT';
    const media = card.querySelector('.shop-media');
    if (media) {
      media.appendChild(badge);
    } else {
      card.prepend(badge);
    }
  }

  if (atc) {
    atc.classList.add('retail-atc--onboarding-focus');
    placeProductCoachmark(atc);
    atc.focus({ preventScroll: true });

    const onAtcClick = () => {
      clearOnboardingProductHighlight();
      if (highlightTimer !== null) {
        window.clearTimeout(highlightTimer);
        highlightTimer = null;
      }
    };
    atcClearHandler = onAtcClick;
    atcClearTarget = atc;
    atc.addEventListener('click', onAtcClick);
  }

  return productName;
}

/**
 * Reveal the onboarding product in the test-shop grid.
 * Idempotent / single-flight so React + page-script delegation can both call it.
 */
export function revealOnboardingProduct(
  input: RevealOnboardingProductInput,
  callbacks: RevealOnboardingProductCallbacks = {},
): void {
  if (typeof window === 'undefined') return;

  if (pendingRevealTimer !== null) {
    window.clearTimeout(pendingRevealTimer);
    pendingRevealTimer = null;
  }
  if (paintTimer !== null) {
    window.clearTimeout(paintTimer);
    paintTimer = null;
  }

  applyCategoryForProduct(input.category);

  pendingRevealTimer = window.setTimeout(() => {
    pendingRevealTimer = null;
    const item = findProductItem(input.id);
    if (!item) {
      if (input.allowNavigateFromPdp || !document.querySelector('.shop-page')) {
        const params = new URLSearchParams({
          category: input.category,
          highlight: '1',
        });
        callbacks.onNavigating?.();
        window.location.assign(`/admin/test-shop?${params.toString()}`);
        return;
      }
      console.error('[retail-onboarding] Could not locate onboarding product in DOM.', {
        productId: input.id,
      });
      callbacks.onMissing?.();
      return;
    }

    item.hidden = false;
    void item.offsetHeight;
    scrollRevealTargetIntoView(item);

    paintTimer = window.setTimeout(() => {
      paintTimer = null;
      paintProductReveal(item, input.name);
      callbacks.onPainted?.(input.name);
      clearHighlightQuery();

      if (highlightTimer !== null) {
        window.clearTimeout(highlightTimer);
      }
      highlightTimer = window.setTimeout(() => {
        clearOnboardingProductHighlight();
        highlightTimer = null;
      }, HIGHLIGHT_MS);
    }, 50);
  }, 180);
}

/** Bind progressive-enhancement click handler (safe to call once per page). */
export function bindRetailShowProductDelegation() {
  if (typeof window === 'undefined') return;
  if (window.__kersivoRetailShowProductBound) return;
  window.__kersivoRetailShowProductBound = true;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>('[data-retail-show-product]');
    if (!button) return;

    const id = button.getAttribute('data-retail-show-product');
    if (!id) return;

    const category = button.getAttribute('data-retail-show-category') || 'STYLING';
    const name = button.getAttribute('data-retail-show-name') || 'Your product';
    const onShopPage = Boolean(document.querySelector('.shop-page'));

    revealOnboardingProduct({
      id,
      name,
      category,
      allowNavigateFromPdp: !onShopPage,
    });
  });
}

declare global {
  interface Window {
    __kersivoRetailShowProductBound?: boolean;
  }
}
