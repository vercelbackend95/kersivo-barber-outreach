import { canSendAdvertisingEvent, canSendAnalyticsEvent } from './cleanup';
import { readConsentPreferences } from './storage';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type TrackEventCategory = 'analytics' | 'advertising' | 'analytics_or_advertising';

/**
 * Consent-aware event dispatcher. Does not queue or replay events after later consent.
 */
export function trackConsentedEvent(
  name: string,
  params?: Record<string, string | number | boolean | undefined>,
  category: TrackEventCategory = 'analytics',
): boolean {
  if (typeof window === 'undefined') return false;

  const prefs = readConsentPreferences();
  if (!prefs) return false;

  if (category === 'analytics' && !prefs.analytics) return false;
  if (category === 'advertising' && !prefs.advertisingMeasurement) return false;
  if (
    category === 'analytics_or_advertising' &&
    !prefs.analytics &&
    !prefs.advertisingMeasurement
  ) {
    return false;
  }

  if (typeof window.gtag !== 'function') return false;

  window.gtag('event', name, {
    transport_type: 'beacon',
    ...params,
  });
  return true;
}

export function analyticsAllowed(): boolean {
  return canSendAnalyticsEvent();
}

export function advertisingAllowed(): boolean {
  return canSendAdvertisingEvent();
}
