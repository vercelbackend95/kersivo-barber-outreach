/** Asks every mounted launch/readiness surface (e.g. the sidebar launch card) to refetch. */
export const LAUNCH_CONTEXT_REFRESH_EVENT = 'kersivo:launch-context-refresh';

export function dispatchLaunchContextRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LAUNCH_CONTEXT_REFRESH_EVENT));
}
