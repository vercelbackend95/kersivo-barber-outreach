import { useEffect, useRef } from 'react';

import { initFeature261StaggerReveal } from '@/lib/landing/initFeature261StaggerReveal';

/**
 * Stagger-reveal for Feature261 cards. Runs inside React after hydration so
 * data-feature261-visible is not wiped by the reconciliation pass.
 */
export function useFeature261StaggerReveal() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return undefined;
    }

    return initFeature261StaggerReveal(section);
  }, []);

  return sectionRef;
}
