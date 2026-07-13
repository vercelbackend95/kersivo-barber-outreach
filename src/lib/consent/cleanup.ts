import { CONSENT_COOKIE_NAME } from './config';
import { readConsentPreferences } from './storage';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** First-party Google Analytics / Ads cookie name patterns we may clear on withdraw. */
export const OPTIONAL_COOKIE_PREFIXES = ['_ga', '_gid', '_gcl', '_gac'] as const;

function deleteCookie(name: string): void {
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  const domains: string[] = [''];
  if (typeof location !== 'undefined' && location.hostname) {
    domains.push(location.hostname);
    if (location.hostname.includes('.')) {
      domains.push(`.${location.hostname}`);
    }
  }
  for (const domain of domains) {
    const domainPart = domain ? `; Domain=${domain}` : '';
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}${domainPart}`;
  }
}

/**
 * Removes removable first-party optional tracking cookies.
 * Does not touch necessary app cookies (consent, admin session) or localStorage carts.
 * Third-party Google cookies on other domains cannot be deleted from this origin.
 */
export function clearOptionalTrackingCookies(): void {
  if (typeof document === 'undefined') return;

  const names = document.cookie
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter(Boolean);

  for (const name of names) {
    if (name === CONSENT_COOKIE_NAME) continue;
    if (OPTIONAL_COOKIE_PREFIXES.some((prefix) => name === prefix || name.startsWith(`${prefix}_`) || name.startsWith(prefix))) {
      deleteCookie(name);
    }
  }
}

/**
 * Clears optional conversion-dedup keys from sessionStorage.
 * Leaves necessary app sessionStorage (e.g. landing widget prefs) alone.
 */
export function clearOptionalSessionStorage(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      if (key.startsWith('setup_deposit_paid:')) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

export function clearOptionalStorageOnWithdraw(): void {
  clearOptionalTrackingCookies();
  clearOptionalSessionStorage();
}

export function canSendAnalyticsEvent(): boolean {
  return readConsentPreferences()?.analytics === true;
}

export function canSendAdvertisingEvent(): boolean {
  return readConsentPreferences()?.advertisingMeasurement === true;
}
