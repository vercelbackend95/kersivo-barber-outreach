import { useEffect, useState } from 'react';

/** Matches BookingsAdminPanel and `@media (max-width: 48rem)` admin mobile chrome. */
export const ADMIN_MOBILE_CHROME_MAX_PX = 768;

/**
 * True when the fixed mobile admin header + Next strip layout is active (narrow viewport).
 * Does not register the strip — that is handled by AdminGlobalMobileNextStripHost.
 */
export function useAdminMobileChromeBreakpoint(): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${ADMIN_MOBILE_CHROME_MAX_PX}px)`);
    const update = () => setMatches(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return matches;
}
