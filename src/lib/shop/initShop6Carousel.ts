const SCROLL_TOLERANCE = 2;

type CarouselInstance = {
  carousel: HTMLElement;
  onPrev: () => void;
  onNext: () => void;
  onScroll: () => void;
  onResize: () => void;
  onWheel: (event: WheelEvent) => void;
  onLoad: () => void;
  prevButton: Element | null;
  nextButton: Element | null;
  resizeObserver?: ResizeObserver;
};

const instances = new WeakMap<HTMLElement, CarouselInstance>();

function initShop6CarouselRoot(root: HTMLElement): void {
  if (instances.has(root)) {
    return;
  }

  const carousel = root.querySelector('[data-shop6-carousel]');
  const prevButton = root.querySelector('[data-shop6-prev]');
  const nextButton = root.querySelector('[data-shop6-next]');
  const firstItem = carousel?.querySelector('.shop6__item');

  if (!(carousel instanceof HTMLElement) || !(firstItem instanceof HTMLElement)) {
    return;
  }

  const getMaxScroll = () => Math.max(0, carousel.scrollWidth - carousel.clientWidth);

  const cardStep = () => {
    const items = carousel.querySelectorAll('.shop6__item');
    const a = items[0];
    const b = items[1];
    if (a instanceof HTMLElement && b instanceof HTMLElement && b.offsetParent !== null) {
      const step = b.offsetLeft - a.offsetLeft;
      if (step > 1) return step;
    }
    const itemWidth = firstItem.getBoundingClientRect().width;
    const carouselStyles = window.getComputedStyle(carousel);
    const gap = Number.parseFloat(carouselStyles.columnGap || carouselStyles.gap || '0') || 0;
    return itemWidth + gap;
  };

  const cardsPerPage = () => {
    const step = cardStep();
    if (step <= 0) return 1;
    return Math.max(1, Math.floor((carousel.clientWidth + SCROLL_TOLERANCE) / step));
  };

  const updateEdges = () => {
    const maxScroll = getMaxScroll();
    const currentScroll = carousel.scrollLeft;
    const canScroll = maxScroll > SCROLL_TOLERANCE;

    root.dataset.canScrollLeft = String(canScroll && currentScroll > SCROLL_TOLERANCE);
    root.dataset.canScrollRight = String(canScroll && currentScroll < maxScroll - SCROLL_TOLERANCE);
  };

  const updateControls = () => {
    updateEdges();

    if (!(prevButton instanceof HTMLButtonElement) || !(nextButton instanceof HTMLButtonElement)) {
      return;
    }

    const maxScroll = getMaxScroll();
    const currentScroll = carousel.scrollLeft;
    const canScroll = maxScroll > SCROLL_TOLERANCE;

    prevButton.disabled = !canScroll || currentScroll <= SCROLL_TOLERANCE;
    nextButton.disabled = !canScroll || currentScroll >= maxScroll - SCROLL_TOLERANCE;
  };

  const scrollCards = (direction: number) => {
    const maxScroll = getMaxScroll();
    if (maxScroll <= SCROLL_TOLERANCE) return;

    const pageStep = cardStep() * cardsPerPage();
    const target = Math.max(0, Math.min(maxScroll, carousel.scrollLeft + pageStep * direction));
    carousel.scrollTo({ left: target, behavior: 'smooth' });
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
    carousel.scrollBy({
      left: dx,
      behavior: 'auto',
    });
  };

  const onScroll = () => updateControls();
  const onResize = () => updateControls();
  const onLoad = () => updateControls();

  prevButton?.addEventListener('click', onPrev);
  nextButton?.addEventListener('click', onNext);
  carousel.addEventListener('wheel', onWheel, { passive: false });
  carousel.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  carousel.addEventListener('load', onLoad, true);

  let resizeObserver: ResizeObserver | undefined;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateControls());
    resizeObserver.observe(carousel);
  }

  instances.set(root, {
    carousel,
    onPrev,
    onNext,
    onScroll,
    onResize,
    onWheel,
    onLoad,
    prevButton,
    nextButton,
    resizeObserver,
  });

  requestAnimationFrame(() => requestAnimationFrame(updateControls));
  updateControls();
}

export function initShop6Carousels(scope: ParentNode = document): void {
  const roots = Array.from(scope.querySelectorAll('[data-shop6-carousel-root]')).filter(
    (root): root is HTMLElement => root instanceof HTMLElement,
  );

  if (roots.length === 0) {
    return;
  }

  const initAll = () => {
    roots.forEach((root) => {
      initShop6CarouselRoot(root);
    });
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
      if (hasInitialized) {
        return;
      }

      const isVisible = entries.some((entry) => entry.isIntersecting);
      if (!isVisible) {
        return;
      }

      hasInitialized = true;
      observer.disconnect();
      scheduleInit();
    },
    { rootMargin: '200px 0px' },
  );

  roots.forEach((root) => observer.observe(root));
}

export function destroyShop6Carousels(scope: ParentNode = document): void {
  const roots = scope.querySelectorAll('[data-shop6-carousel-root]');
  roots.forEach((root) => {
    if (!(root instanceof HTMLElement)) {
      return;
    }

    const instance = instances.get(root);
    if (!instance) {
      return;
    }

    const prevButton = instance.prevButton;
    const nextButton = instance.nextButton;

    prevButton?.removeEventListener('click', instance.onPrev);
    nextButton?.removeEventListener('click', instance.onNext);
    instance.carousel.removeEventListener('wheel', instance.onWheel);
    instance.carousel.removeEventListener('scroll', instance.onScroll);
    window.removeEventListener('resize', instance.onResize);
    instance.carousel.removeEventListener('load', instance.onLoad, true);
    instance.resizeObserver?.disconnect();
    instances.delete(root);
  });
}
