import type { ConsentPreferences, GoogleConsentState } from './types';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __kersivoConsentDefaultsApplied?: boolean;
  }
}

export function ensureGtagStub(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  }
}

export function preferencesToGoogleConsent(prefs: ConsentPreferences | null): GoogleConsentState {
  const analytics = prefs?.analytics === true;
  const ads = prefs?.advertisingMeasurement === true;
  return {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: ads ? 'granted' : 'denied',
    ad_user_data: ads ? 'granted' : 'denied',
    // Personalised advertising is not offered in the current consent UI.
    ad_personalization: 'denied',
  };
}

export function applyConsentDefaultDenied(): void {
  if (typeof window === 'undefined') return;
  ensureGtagStub();
  if (window.__kersivoConsentDefaultsApplied) return;
  window.gtag!('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });
  window.__kersivoConsentDefaultsApplied = true;
}

export function updateGoogleConsent(prefs: ConsentPreferences | null): void {
  if (typeof window === 'undefined') return;
  ensureGtagStub();
  window.gtag!('consent', 'update', preferencesToGoogleConsent(prefs));
}
