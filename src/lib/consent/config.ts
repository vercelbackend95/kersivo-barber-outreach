/** Increment when purposes or policy materially change — forces re-consent. */
export const CONSENT_VERSION = 1;

export const CONSENT_COOKIE_NAME = 'kersivo_consent';

/** Consent preference cookie lifetime (necessary record). */
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // 180 days

export const CONSENT_OPEN_EVENT = 'kersivo:cookie-settings-open';

export const CONSENT_CHANGED_EVENT = 'kersivo:consent-changed';

export const BANNER_COPY = {
  title: 'Your privacy choices',
  body: 'We use necessary cookies to keep KERSIVO working. With your permission, we also use analytics to understand website performance and advertising technologies to measure our Google Ads campaigns. You can accept all optional technologies, reject them, or choose your preferences.',
  acceptAll: 'Accept all',
  rejectOptional: 'Reject optional',
  managePreferences: 'Manage preferences',
  cookiePolicy: 'Read our Cookie Policy',
} as const;

export const PREFS_COPY = {
  title: 'Cookie preferences',
  necessaryTitle: 'Necessary',
  necessaryStatus: 'Always active',
  necessaryBody:
    'Required for security, payments, forms, booking functionality and remembering your privacy choices. These technologies cannot be switched off through this tool.',
  analyticsTitle: 'Analytics',
  analyticsBody:
    'Helps us understand how visitors use KERSIVO so we can improve website performance and usability. Provider: Google Analytics 4 (when enabled).',
  adsTitle: 'Advertising measurement',
  adsBody:
    'Helps us understand whether our Google Ads lead to enquiries or setup purchases. We do not currently use this setting for personalised advertising. Provider: Google Ads (when a measurement ID is configured).',
  save: 'Save choices',
  acceptAll: 'Accept all',
  rejectOptional: 'Reject optional',
  close: 'Close',
} as const;
