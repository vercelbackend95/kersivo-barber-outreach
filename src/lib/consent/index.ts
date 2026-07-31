import { CONSENT_CHANGED_EVENT, CONSENT_OPEN_EVENT } from './config';
import {
  clearOptionalStorageOnWithdraw,
} from './cleanup';
import { applyConsentDefaultDenied, updateGoogleConsent } from './googleConsent';
import { trackConsentedEvent } from './events';
import {
  createPreferences,
  hasValidConsentDecision,
  readConsentPreferences,
  writeConsentPreferences,
} from './storage';
import { syncTagsForConsent, type TagLoaderIds } from './tagLoader';
import type { ConsentChoiceInput, ConsentPreferences } from './types';

export * from './config';
export * from './types';
export {
  createPreferences,
  hasValidConsentDecision,
  parseConsentCookieValue,
  readConsentPreferences,
  writeConsentPreferences,
} from './storage';
export { preferencesToGoogleConsent, updateGoogleConsent } from './googleConsent';
export { trackConsentedEvent, analyticsAllowed, advertisingAllowed } from './events';
export {
  clearOptionalStorageOnWithdraw,
  clearOptionalTrackingCookies,
  OPTIONAL_COOKIE_PREFIXES,
} from './cleanup';
export { syncTagsForConsent } from './tagLoader';

export function resolvePublicTagIds(): TagLoaderIds {
  const gaFromEnv = (
    import.meta.env.PUBLIC_GA4_MEASUREMENT_ID ??
    (typeof process !== 'undefined' ? process.env.PUBLIC_GA4_MEASUREMENT_ID : '') ??
    ''
  )
    .toString()
    .trim();
  const adsFromEnv = (
    import.meta.env.PUBLIC_GOOGLE_ADS_ID ??
    (typeof process !== 'undefined' ? process.env.PUBLIC_GOOGLE_ADS_ID : '') ??
    ''
  )
    .toString()
    .trim();

  return {
    gaMeasurementId: gaFromEnv,
    googleAdsId: adsFromEnv,
  };
}

export async function applyConsentChoice(
  input: ConsentChoiceInput,
  ids?: TagLoaderIds,
): Promise<ConsentPreferences> {
  const prefs = createPreferences(input);
  const previous = readConsentPreferences();
  writeConsentPreferences(prefs);
  updateGoogleConsent(prefs);

  const withdrawingAnalytics = previous?.analytics && !prefs.analytics;
  const withdrawingAds = previous?.advertisingMeasurement && !prefs.advertisingMeasurement;
  const withdrawingPersonalised =
    previous?.personalisedAdvertising && !prefs.personalisedAdvertising;
  if (withdrawingAnalytics || withdrawingAds || withdrawingPersonalised) {
    clearOptionalStorageOnWithdraw();
  }

  await syncTagsForConsent(prefs, ids ?? resolvePublicTagIds());

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: prefs }));
  }

  return prefs;
}

export function openCookieSettings(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
}

export function bootConsentRuntime(ids: TagLoaderIds): ConsentPreferences | null {
  applyConsentDefaultDenied();
  const prefs = readConsentPreferences();
  if (prefs) {
    updateGoogleConsent(prefs);
    void syncTagsForConsent(prefs, ids);
  }
  return prefs;
}
