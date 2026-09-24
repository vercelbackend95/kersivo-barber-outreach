import type { ConsentChoiceInput, ConsentPreferences } from './types';

/**
 * Increment when purposes or policy materially change — forces re-consent.
 * v3: Google Ads optional purposes are capability-gated (hidden / forced false
 * when PUBLIC_GOOGLE_ADS_ID is absent). Invalidates v2 records so Ads grants
 * cannot silently survive Ads-dormant Production.
 *
 * Future Ads reactivation: reintroducing Ads optional purposes is a material
 * consent-purpose expansion and MUST bump CONSENT_VERSION again before Ads
 * purposes become choosable in Production.
 */
export const CONSENT_VERSION = 3;

export const CONSENT_COOKIE_NAME = 'kersivo_consent';

/** Consent preference cookie lifetime (necessary record). */
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // 180 days

export const CONSENT_OPEN_EVENT = 'kersivo:cookie-settings-open';

export const CONSENT_CHANGED_EVENT = 'kersivo:consent-changed';

export const BANNER_COPY = {
  title: 'Your privacy choices',
  /** Ads-capable first-layer body (Google Ads ID configured). */
  bodyAdsConfigured:
    'We use necessary cookies to run KERSIVO. With your permission we also use analytics and advertising cookies for site performance and Google Ads. Accept all, reject optional, or manage preferences.',
  /** Analytics-only first-layer body (Google Ads ID absent / dormant). */
  bodyAnalyticsOnly:
    'We use necessary cookies to run KERSIVO. With your permission we also use analytics cookies to understand site performance. Accept all, reject optional, or manage preferences.',
  acceptAll: 'Accept all',
  rejectOptional: 'Reject optional',
  managePreferences: 'Manage preferences',
  cookiePolicy: 'Cookie Policy',
} as const;

export const PREFS_COPY = {
  title: 'Cookie preferences',
  necessaryTitle: 'Necessary',
  necessaryStatus: 'Always active',
  necessaryBody:
    'Required for security, payments, forms, booking functionality, remembering your privacy choices, and keeping your admin account signed in. These technologies cannot be switched off through this tool.',
  analyticsTitle: 'Analytics',
  analyticsBody:
    'Helps us understand how visitors use KERSIVO so we can improve website performance and usability. Provider: Google Analytics 4 (when enabled).',
  adsTitle: 'Advertising measurement',
  adsBody:
    'Helps us understand whether our Google Ads lead to enquiries or subscriptions. This setting only measures results — it does not add you to advertising audiences. Provider: Google Ads (when a measurement ID is configured).',
  personalisedTitle: 'Personalised advertising',
  personalisedBody:
    'Lets Google add you to our remarketing audiences, so we can show KERSIVO ads to people who already visited this site. Provider: Google Ads (when a measurement ID is configured).',
  save: 'Save choices',
  acceptAll: 'Accept all',
  rejectOptional: 'Reject optional',
  close: 'Close',
} as const;

/** True when a non-empty public Google Ads ID is available at runtime. */
export function isGoogleAdsCapabilityEnabled(
  googleAdsId: string | null | undefined,
): boolean {
  return Boolean(googleAdsId?.toString().trim());
}

export function resolveBannerBody(adsEnabled: boolean): string {
  return adsEnabled ? BANNER_COPY.bodyAdsConfigured : BANNER_COPY.bodyAnalyticsOnly;
}

/**
 * When Ads capability is absent, force Ads purposes false so Accept all /
 * Manage preferences cannot persist misleading Ads grants.
 */
export function normalizeConsentChoiceForAdsCapability(
  input: ConsentChoiceInput,
  adsEnabled: boolean,
): ConsentChoiceInput {
  if (adsEnabled) {
    return {
      analytics: Boolean(input.analytics),
      advertisingMeasurement: Boolean(input.advertisingMeasurement),
      personalisedAdvertising: Boolean(input.personalisedAdvertising),
    };
  }
  return {
    analytics: Boolean(input.analytics),
    advertisingMeasurement: false,
    personalisedAdvertising: false,
  };
}

export function acceptAllChoiceForAdsCapability(adsEnabled: boolean): ConsentChoiceInput {
  return normalizeConsentChoiceForAdsCapability(
    {
      analytics: true,
      advertisingMeasurement: true,
      personalisedAdvertising: true,
    },
    adsEnabled,
  );
}

export function rejectOptionalChoice(): ConsentChoiceInput {
  return {
    analytics: false,
    advertisingMeasurement: false,
    personalisedAdvertising: false,
  };
}

/**
 * Stored consent vs effective consent:
 * - Stored = what the cookie records (do not rewrite on every boot).
 * - Effective = what current tag capability may activate.
 * When Ads ID is absent, effective Ads purposes are forced false even if the
 * cookie still contains Ads=true (fail closed for Consent Mode / tags).
 */
export function toEffectiveConsentPreferences(
  prefs: ConsentPreferences,
  googleAdsId: string | null | undefined,
): ConsentPreferences {
  if (isGoogleAdsCapabilityEnabled(googleAdsId)) return prefs;
  if (!prefs.advertisingMeasurement && !prefs.personalisedAdvertising) return prefs;
  return {
    ...prefs,
    advertisingMeasurement: false,
    personalisedAdvertising: false,
  };
}
