import { useEffect, useState, type RefObject } from 'react';

/** Matches @container reports-studio (max-width: 42rem) in booking.css */
export const COMPACT_REPORTS_MAX_WIDTH_PX = 672;

export function useCompactReportsLayout(ref: RefObject<HTMLElement | null>) {
  const [isContainerCompact, setIsContainerCompact] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;

    const syncCompact = (width: number) => {
      const compact = width < COMPACT_REPORTS_MAX_WIDTH_PX;
      setIsContainerCompact(compact);
      if (compact) {
        element.setAttribute('data-reports-compact', '');
      } else {
        element.removeAttribute('data-reports-compact');
      }
    };

    syncCompact(element.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      syncCompact(entry.contentRect.width);
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
      element.removeAttribute('data-reports-compact');
    };
  }, [ref]);

  return isContainerCompact;
}
