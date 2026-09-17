import { useEffect, useState } from 'react';

/** Matches feature261 stacked layout — passive landing previews at this width. */
export const LANDING_PREVIEW_PASSIVE_MQ = '(max-width: 899px)';

/**
 * True when the viewport is max-width 899px.
 * SSR / first paint defaults to false (desktop-first); hydrates via matchMedia.
 */
export function useMaxWidthPassive(query: string = LANDING_PREVIEW_PASSIVE_MQ): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia(query);
    const sync = () => setMatches(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener('change', sync);
    return () => mediaQuery.removeEventListener('change', sync);
  }, [query]);

  return matches;
}
