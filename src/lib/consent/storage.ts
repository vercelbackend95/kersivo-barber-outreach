import {
  CONSENT_COOKIE_NAME,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_VERSION,
} from './config';
import type { ConsentChoiceInput, ConsentPreferences } from './types';

function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

export function createPreferences(input: ConsentChoiceInput): ConsentPreferences {
  return {
    version: CONSENT_VERSION,
    necessary: true,
    analytics: Boolean(input.analytics),
    advertisingMeasurement: Boolean(input.advertisingMeasurement),
    personalisedAdvertising: Boolean(input.personalisedAdvertising),
    timestamp: new Date().toISOString(),
  };
}

export function parseConsentCookieValue(raw: string | null | undefined): ConsentPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (parsed.necessary !== true) return null;
    if (typeof parsed.analytics !== 'boolean') return null;
    if (typeof parsed.advertisingMeasurement !== 'boolean') return null;
    if (typeof parsed.personalisedAdvertising !== 'boolean') return null;
    if (typeof parsed.timestamp !== 'string' || !parsed.timestamp) return null;
    return {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: parsed.analytics,
      advertisingMeasurement: parsed.advertisingMeasurement,
      personalisedAdvertising: parsed.personalisedAdvertising,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

export function readConsentPreferences(): ConsentPreferences | null {
  if (!isBrowser()) return null;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(CONSENT_COOKIE_NAME.length + 1));
  return parseConsentCookieValue(value);
}

export function writeConsentPreferences(prefs: ConsentPreferences): void {
  if (!isBrowser()) return;
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  const encoded = encodeURIComponent(JSON.stringify(prefs));
  document.cookie = `${CONSENT_COOKIE_NAME}=${encoded}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearConsentPreferencesCookie(): void {
  if (!isBrowser()) return;
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function hasValidConsentDecision(): boolean {
  return readConsentPreferences() !== null;
}
