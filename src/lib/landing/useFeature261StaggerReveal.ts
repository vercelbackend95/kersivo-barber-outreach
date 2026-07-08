import { useEffect, useRef } from 'react';

/**
 * Stagger-reveal for Feature261 cards. Runs inside React after hydration so
 * data-feature261-visible is not wiped by the reconciliation pass.
 */
export function useFeature261StaggerReveal() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const cards = Array.from(section.querySelectorAll('[data-feature261-card]'));
    if (cards.length === 0) return undefined;

    const revealCard = (card: Element, index: number) => {
      if (!(card instanceof HTMLElement)) return;
      card.style.transitionDelay = `${index * 140}ms`;
      card.dataset.feature261Visible = 'true';
    };

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.dataset.feature261Enhanced = 'true';

    cards.forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      card.dataset.feature261Visible = 'false';
    });

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      cards.forEach((card, index) => revealCard(card, index));
      return undefined;
    }

    let hasRevealed = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const shouldReveal = entries.some((entry) => entry?.isIntersecting);
        if (!shouldReveal || hasRevealed) return;

        hasRevealed = true;
        cards.forEach((card, index) => revealCard(card, index));
        observer.disconnect();
      },
      {
        threshold: 0.01,
        rootMargin: '0px 0px -6% 0px',
      },
    );

    cards.forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      observer.observe(card);
    });

    return () => observer.disconnect();
  }, []);

  return sectionRef;
}
