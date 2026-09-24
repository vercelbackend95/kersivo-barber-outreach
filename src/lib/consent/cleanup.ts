import { CONSENT_COOKIE_NAME } from './config';
import { readConsentPreferences } from './storage';
import type { ConsentPreferences } from './types';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Analytics first-party Google cookie patterns. */
export const ANALYTICS_COOKIE_PREFIXES = ['_ga', '_gid'] as const;

/** Ads first-party Google cookie patterns. */
export const ADS_COOKIE_PREFIXES = ['_gcl', '_gac'] as const;

/** @deprecated Prefer ANALYTICS_COOKIE_PREFIXES + ADS_COOKIE_PREFIXES. Kept for exports. */
export const OPTIONAL_COOKIE_PREFIXES = ['_ga', '_gid', '_gcl', '_gac'] as const;

/** Exact localStorage keys for Ads linker residue. */
export const OPTIONAL_LOCAL_STORAGE_KEYS = ['_gcl_ls'] as const;

/** Allowlisted web-storage key prefixes for conversion/dedup residue. */
export const OPTIONAL_WEB_STORAGE_PREFIXES = [
  'saas_subscription_paid:',
  'setup_deposit_paid:',
] as const;

const GA4_DEDUP_PREFIX = 'saas_subscription_paid:ga4:';
const ADS_DEDUP_PREFIX = 'saas_subscription_paid:ads:';
const LEGACY_SAAS_DEDUP_PREFIX = 'saas_subscription_paid:';
const SETUP_DEPOSIT_PREFIX = 'setup_deposit_paid:';

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

/** Match `_ga` / `_ga_*` without matching `_gac*`. */
function isAnalyticsCookieName(name: string): boolean {
  if (name === CONSENT_COOKIE_NAME) return false;
  if (name === '_ga' || name.startsWith('_ga_')) return true;
  if (name === '_gid' || name.startsWith('_gid_')) return true;
  return false;
}

function isAdsCookieName(name: string): boolean {
  if (name === CONSENT_COOKIE_NAME) return false;
  return ADS_COOKIE_PREFIXES.some(
    (prefix) => name === prefix || name.startsWith(`${prefix}_`) || name.startsWith(prefix),
  );
}

function isOptionalTrackingCookie(name: string): boolean {
  return isAnalyticsCookieName(name) || isAdsCookieName(name);
}

function isLegacyCombinedSaasDedupKey(key: string): boolean {
  if (!key.startsWith(LEGACY_SAAS_DEDUP_PREFIX)) return false;
  if (key.startsWith(GA4_DEDUP_PREFIX) || key.startsWith(ADS_DEDUP_PREFIX)) return false;
  return true;
}

function isOptionalWebStorageKey(key: string): boolean {
  if ((OPTIONAL_LOCAL_STORAGE_KEYS as readonly string[]).includes(key)) return true;
  return OPTIONAL_WEB_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function listCookieNames(): string[] {
  if (typeof document === 'undefined') return [];
  return document.cookie
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter(Boolean);
}

function listStorageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key) keys.push(key);
    }
  } catch {
    // ignore
  }
  return keys;
}

function clearCookiesMatching(predicate: (name: string) => boolean): void {
  if (typeof document === 'undefined') return;
  for (const name of listCookieNames()) {
    if (predicate(name)) deleteCookie(name);
  }
}

function clearStorageKeysMatching(storage: Storage, predicate: (key: string) => boolean): void {
  try {
    for (const key of listStorageKeys(storage)) {
      if (predicate(key)) storage.removeItem(key);
    }
  } catch {
    // ignore quota / privacy mode errors
  }
}

function clearBothStoragesMatching(predicate: (key: string) => boolean): void {
  if (typeof localStorage !== 'undefined') clearStorageKeysMatching(localStorage, predicate);
  if (typeof sessionStorage !== 'undefined') clearStorageKeysMatching(sessionStorage, predicate);
}

/**
 * Removes removable first-party optional tracking cookies.
 * Does not touch necessary app cookies (consent, admin session).
 * Third-party Google cookies on other domains cannot be deleted from this origin.
 */
export function clearOptionalTrackingCookies(): void {
  clearCookiesMatching(isOptionalTrackingCookie);
}

/**
 * Clears allowlisted optional Ads linker + conversion-dedup keys from localStorage.
 * Leaves carts and unrelated necessary localStorage alone.
 */
export function clearOptionalLocalStorage(): void {
  if (typeof localStorage === 'undefined') return;
  clearStorageKeysMatching(localStorage, isOptionalWebStorageKey);
}

/**
 * Clears allowlisted optional conversion-dedup keys from sessionStorage.
 * Leaves necessary app sessionStorage (e.g. landing widget prefs) alone.
 */
export function clearOptionalSessionStorage(): void {
  if (typeof sessionStorage === 'undefined') return;
  clearStorageKeysMatching(sessionStorage, isOptionalWebStorageKey);
}

/** Clear every allowlisted optional cookie + web-storage key. */
export function clearOptionalStorageOnWithdraw(): void {
  clearOptionalTrackingCookies();
  clearOptionalLocalStorage();
  clearOptionalSessionStorage();
}

function clearAnalyticsBrowserStorage(): void {
  clearCookiesMatching(isAnalyticsCookieName);
}

function clearAdsBrowserStorage(): void {
  clearCookiesMatching(isAdsCookieName);
  if (typeof localStorage !== 'undefined') {
    clearStorageKeysMatching(localStorage, (key) => key === '_gcl_ls');
  }
}

function clearGa4PurchaseDedup(): void {
  clearBothStoragesMatching((key) => key.startsWith(GA4_DEDUP_PREFIX));
}

function clearAdsPurchaseDedup(): void {
  clearBothStoragesMatching((key) => key.startsWith(ADS_DEDUP_PREFIX));
}

function clearLegacyCombinedSaasDedup(): void {
  clearBothStoragesMatching(isLegacyCombinedSaasDedupKey);
}

function clearSetupDepositDedup(): void {
  clearBothStoragesMatching((key) => key.startsWith(SETUP_DEPOSIT_PREFIX));
}

/**
 * Category-aware optional-storage cleanup for a consent transition.
 *
 * - previous === null (missing / invalid / old version): wipe all allowlisted
 *   optional residue once before the new choice is synced.
 * - previous valid: clear only categories no longer permitted by `next`.
 */
export function clearOptionalStorageForConsentTransition(
  previous: ConsentPreferences | null,
  next: ConsentPreferences,
): void {
  if (previous === null) {
    clearOptionalStorageOnWithdraw();
    return;
  }

  if (next.analytics !== true) {
    clearAnalyticsBrowserStorage();
    clearGa4PurchaseDedup();
  }

  const adsBrowserAllowed =
    next.advertisingMeasurement === true || next.personalisedAdvertising === true;
  if (!adsBrowserAllowed) {
    clearAdsBrowserStorage();
  }

  if (next.advertisingMeasurement !== true) {
    clearAdsPurchaseDedup();
  }

  if (!(next.analytics === true && next.advertisingMeasurement === true)) {
    clearLegacyCombinedSaasDedup();
  }

  if (next.analytics !== true || next.advertisingMeasurement !== true) {
    clearSetupDepositDedup();
  }
}

export function canSendAnalyticsEvent(): boolean {
  return readConsentPreferences()?.analytics === true;
}

export function canSendAdvertisingEvent(): boolean {
  return readConsentPreferences()?.advertisingMeasurement === true;
}
