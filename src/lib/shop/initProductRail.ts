const SCROLL_TOLERANCE = 2;

const ROOT_SELECTOR = '[data-product-rail-root], [data-shop6-carousel-root]';
const TRACK_SELECTOR = '[data-product-rail-track], [data-shop6-carousel]';
const ITEM_SELECTOR = '.product-rail__item, .shop6__item';
const PREV_SELECTOR = '[data-product-rail-prev], [data-shop6-prev]';
const NEXT_SELECTOR = '[data-product-rail-next], [data-shop6-next]';
const STATUS_SELECTOR = '[data-product-rail-status]';

type ProductRailInstance = {
  track: HTMLElement;
  onPrev: () => void;
  onNext: () => void;
  onScroll: () => void;
  onResize: () => void;
  onWheel: (event: WheelEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onLoad: () => void;
  prevButtons: HTMLButtonElement[];
  nextButtons: HTMLButtonElement[];
  resizeObserver?: ResizeObserver;
};

const instances = new WeakMap<HTMLElement, ProductRailInstance>();

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function queryButtons(root: HTMLElement, selector: string): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll(selector)).filter(
    (el): el is HTMLButtonElement => el instanceof HTMLButtonElement,
  );
}

function initProductRailRoot(root: HTMLElement): void {
  if (instances.has(root)) {
    return;
  }

  const track = root.querySelector(TRACK_SELECTOR);
  const firstItem = track?.querySelector(ITEM_SELECTOR);
  const prevButtons = queryButtons(root, PREV_SELECTOR);
  const nextButtons = queryButtons(root, NEXT_SELECTOR);
  const status = root.querySelector(STATUS_SELECTOR);

  if (!(track instanceof HTMLElement) || !(firstItem instanceof HTMLElement)) {
    return;
  }

  const getMaxScroll = () => Math.max(0, track.scrollWidth - track.clientWidth);

  const cardStep = () => {
    const items = track.querySelectorAll(ITEM_SELECTOR);
    const a = items[0];
    const b = items[1];
    if (a instanceof HTMLElement && b instanceof HTMLElement && b.offsetParent !== null) {
      const step = b.offsetLeft - a.offsetLeft;
      if (step > 1) return step;
    }
    const itemWidth = firstItem.getBoundingClientRect().width;
    const trackStyles = window.getComputedStyle(track);
    const gap = Number.parseFloat(trackStyles.columnGap || trackStyles.gap || '0') || 0;
    return itemWidth + gap;
  };

  const cardsPerPage = () => {
    const step = cardStep();
    if (step <= 0) return 1;
    return Math.max(1, Math.floor((track.clientWidth + SCROLL_TOLERANCE) / step));
  };

  const currentIndex = () => {
    const step = cardStep();
    if (step <= 0) return 1;
    return Math.min(
      track.querySelectorAll(ITEM_SELECTOR).length,
      Math.max(1, Math.round(track.scrollLeft / step) + 1),
    );
  };

  const updateStatus = () => {
    if (!(status instanceof HTMLElement)) return;
    const total = track.querySelectorAll(ITEM_SELECTOR).length;
    if (total === 0) return;
    const index = currentIndex();
    const padded = String(index).padStart(2, '0');
    const paddedTotal = String(total).padStart(2, '0');
    status.textContent = `${padded} / ${paddedTotal}`;
    status.dataset.productRailStatusText = `Product ${index} of ${total}`;
    status.setAttribute('aria-label', `Product ${index} of ${total}`);
  };

  const updateEdges = () => {
    const maxScroll = getMaxScroll();
    const currentScroll = track.scrollLeft;
    const canScroll = maxScroll > SCROLL_TOLERANCE;
    const canLeft = canScroll && currentScroll > SCROLL_TOLERANCE;
    const canRight = canScroll && currentScroll < maxScroll - SCROLL_TOLERANCE;

    root.dataset.canScrollLeft = String(canLeft);
    root.dataset.canScrollRight = String(canRight);
  };

  const updateControls = () => {
    updateEdges();
    updateStatus();

    const maxScroll = getMaxScroll();
    const currentScroll = track.scrollLeft;
    const canScroll = maxScroll > SCROLL_TOLERANCE;
    const prevDisabled = !canScroll || currentScroll <= SCROLL_TOLERANCE;
    const nextDisabled = !canScroll || currentScroll >= maxScroll - SCROLL_TOLERANCE;

    for (const button of prevButtons) {
      button.disabled = prevDisabled;
      button.tabIndex = prevDisabled ? -1 : 0;
      button.setAttribute('aria-disabled', String(prevDisabled));
    }
    for (const button of nextButtons) {
      button.disabled = nextDisabled;
      button.tabIndex = nextDisabled ? -1 : 0;
      button.setAttribute('aria-disabled', String(nextDisabled));
    }
  };

  const scrollCards = (direction: number) => {
    const maxScroll = getMaxScroll();
    if (maxScroll <= SCROLL_TOLERANCE) return;

    const pageStep = cardStep() * cardsPerPage();
    const target = Math.max(0, Math.min(maxScroll, track.scrollLeft + pageStep * direction));
    track.scrollTo({
      left: target,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  const onPrev = () => scrollCards(-1);
  const onNext = () => scrollCards(1);

  const onWheel = (event: WheelEvent) => {
    const maxScroll = getMaxScroll();
    if (maxScroll <= SCROLL_TOLERANCE) return;

    let dx = 0;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      dx = event.deltaX;
    } else if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      dx = event.deltaY;
    } else {
      return;
    }

    event.preventDefault();
    track.scrollBy({ left: dx, behavior: 'auto' });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onNext();
    } else if (event.key === 'Home') {
      event.preventDefault();
      track.scrollTo({ left: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    } else if (event.key === 'End') {
      event.preventDefault();
      track.scrollTo({
        left: getMaxScroll(),
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }
  };

  const onScroll = () => updateControls();
  const onResize = () => updateControls();
  const onLoad = () => updateControls();

  for (const button of prevButtons) button.addEventListener('click', onPrev);
  for (const button of nextButtons) button.addEventListener('click', onNext);
  track.addEventListener('wheel', onWheel, { passive: false });
  track.addEventListener('scroll', onScroll, { passive: true });
  root.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  track.addEventListener('load', onLoad, true);

  let resizeObserver: ResizeObserver | undefined;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateControls());
    resizeObserver.observe(track);
  }

  instances.set(root, {
    track,
    onPrev,
    onNext,
    onScroll,
    onResize,
    onWheel,
    onKeyDown,
    onLoad,
    prevButtons,
    nextButtons,
    resizeObserver,
  });

  requestAnimationFrame(() => requestAnimationFrame(updateControls));
  updateControls();
}

export function destroyProductRails(scope: ParentNode = document): void {
  const roots = scope.querySelectorAll(ROOT_SELECTOR);
  roots.forEach((root) => {
    if (!(root instanceof HTMLElement)) return;

    const instance = instances.get(root);
    if (!instance) return;

    for (const button of instance.prevButtons) button.removeEventListener('click', instance.onPrev);
    for (const button of instance.nextButtons) button.removeEventListener('click', instance.onNext);
    instance.track.removeEventListener('wheel', instance.onWheel);
    instance.track.removeEventListener('scroll', instance.onScroll);
    root.removeEventListener('keydown', instance.onKeyDown);
    window.removeEventListener('resize', instance.onResize);
    instance.track.removeEventListener('load', instance.onLoad, true);
    instance.resizeObserver?.disconnect();
    instances.delete(root);
  });
}

export function initProductRails(scope: ParentNode = document): void {
  destroyProductRails(scope);

  const roots = Array.from(scope.querySelectorAll(ROOT_SELECTOR)).filter(
    (root): root is HTMLElement => root instanceof HTMLElement,
  );

  if (roots.length === 0) return;

  const initAll = () => {
    roots.forEach((root) => initProductRailRoot(root));
  };

  const scheduleInit = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(initAll, { timeout: 2000 });
      return;
    }
    window.requestAnimationFrame(initAll);
  };

  if (!('IntersectionObserver' in window)) {
    scheduleInit();
    return;
  }

  let hasInitialized = false;
  const observer = new IntersectionObserver(
    (entries) => {
      if (hasInitialized) return;
      const isVisible = entries.some((entry) => entry.isIntersecting);
      if (!isVisible) return;
      hasInitialized = true;
      observer.disconnect();
      scheduleInit();
    },
    { rootMargin: '200px 0px' },
  );

  roots.forEach((root) => observer.observe(root));
}

/** @deprecated Use initProductRails */
export const initShop6Carousels = initProductRails;
/** @deprecated Use destroyProductRails */
export const destroyShop6Carousels = destroyProductRails;
