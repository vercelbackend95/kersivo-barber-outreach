/** Asks every mounted launch/readiness surface (e.g. the sidebar launch card) to refetch. */
export const LAUNCH_CONTEXT_REFRESH_EVENT = 'kersivo:launch-context-refresh';

/** Bounded re-checks after returning from Stripe onboarding (readiness can lag the redirect). */
export const STRIPE_RETURN_REFRESH_DELAYS_MS = [0, 750, 1500, 3000] as const;

export function dispatchLaunchContextRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LAUNCH_CONTEXT_REFRESH_EVENT));
}
