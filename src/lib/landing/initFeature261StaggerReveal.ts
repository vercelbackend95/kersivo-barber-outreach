/**
 * Stagger-reveal for Feature261 cards (static Astro rows + late-hydrating React islands).
 */
export function initFeature261StaggerReveal(scope: ParentNode = document): () => void {
  const section =
    scope instanceof HTMLElement && scope.classList.contains('feature261')
      ? scope
      : scope.querySelector('.feature261');

  if (!(section instanceof HTMLElement)) {
    return () => {};
  }

  const rows = section.querySelector('.feature261__rows');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  section.dataset.feature261Enhanced = 'true';

  let hasRevealed = prefersReducedMotion || !('IntersectionObserver' in window);

  const revealCard = (card: HTMLElement, index: number) => {
    card.style.transitionDelay = `${index * 140}ms`;
    card.dataset.feature261Visible = 'true';
  };

  const getCards = (): HTMLElement[] =>
    Array.from(section.querySelectorAll('[data-feature261-card]')).filter(
      (card): card is HTMLElement => card instanceof HTMLElement,
    );

  const syncCards = (): HTMLElement[] => {
    const cards = getCards();
    cards.forEach((card) => {
      if (!hasRevealed && card.dataset.feature261Visible !== 'true') {
        card.dataset.feature261Visible = 'false';
      }
    });
    return cards;
  };

  const observedCards = new WeakSet<HTMLElement>();
  let intersectionObserver: IntersectionObserver | undefined;

  const observeCard = (card: HTMLElement) => {
    if (hasRevealed || !intersectionObserver || observedCards.has(card)) {
      return;
    }
    observedCards.add(card);
    intersectionObserver.observe(card);
  };

  if (!hasRevealed) {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (hasRevealed) {
          return;
        }

        const shouldReveal = entries.some((entry) => entry.isIntersecting);
        if (!shouldReveal) {
          return;
        }

        hasRevealed = true;
        getCards().forEach((card, index) => revealCard(card, index));
        intersectionObserver?.disconnect();
        intersectionObserver = undefined;
      },
      {
        threshold: 0.01,
        rootMargin: '0px 0px -6% 0px',
      },
    );
  }

  const initialCards = syncCards();
  if (hasRevealed) {
    initialCards.forEach((card, index) => revealCard(card, index));
  } else {
    initialCards.forEach(observeCard);
  }

  let mutationObserver: MutationObserver | undefined;
  if (rows instanceof HTMLElement && 'MutationObserver' in window) {
    mutationObserver = new MutationObserver(() => {
      const cards = syncCards();
      if (hasRevealed) {
        cards.forEach((card, index) => revealCard(card, index));
        return;
      }
      cards.forEach(observeCard);
    });
    mutationObserver.observe(rows, { childList: true, subtree: true });
  }

  return () => {
    intersectionObserver?.disconnect();
    mutationObserver?.disconnect();
  };
}
