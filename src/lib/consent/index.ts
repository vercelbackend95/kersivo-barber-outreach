import {
  CONSENT_CHANGED_EVENT,
  CONSENT_OPEN_EVENT,
  isGoogleAdsCapabilityEnabled,
  normalizeConsentChoiceForAdsCapability,
  toEffectiveConsentPreferences,
} from './config';
import { clearOptionalStorageForConsentTransition } from './cleanup';
import { applyConsentDefaultDenied, updateGoogleConsent } from './googleConsent';
import {
  createPreferences,
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
  clearOptionalStorageForConsentTransition,
  clearOptionalTrackingCookies,
  clearOptionalLocalStorage,
  clearOptionalSessionStorage,
  OPTIONAL_COOKIE_PREFIXES,
  OPTIONAL_LOCAL_STORAGE_KEYS,
  OPTIONAL_WEB_STORAGE_PREFIXES,
  ANALYTICS_COOKIE_PREFIXES,
  ADS_COOKIE_PREFIXES,
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
  // Capture prior valid decision before overwrite. Invalid/old/missing => null.
  const previous = readConsentPreferences();
  const resolvedIds = ids ?? resolvePublicTagIds();
  const adsEnabled = isGoogleAdsCapabilityEnabled(resolvedIds.googleAdsId);
  const prefs = createPreferences(normalizeConsentChoiceForAdsCapability(input, adsEnabled));
  writeConsentPreferences(prefs);
  // Prefs already clamped at write time; pass through effective for clarity.
  updateGoogleConsent(toEffectiveConsentPreferences(prefs, resolvedIds.googleAdsId));

  clearOptionalStorageForConsentTransition(previous, prefs);

  await syncTagsForConsent(prefs, resolvedIds);

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
    // Do not rewrite the cookie on boot — clamp Ads for Consent Mode / tags only.
    const effective = toEffectiveConsentPreferences(prefs, ids.googleAdsId);
    updateGoogleConsent(effective);
    void syncTagsForConsent(effective, ids);
  }
  return prefs;
}
