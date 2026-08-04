/**
 * Client orchestrator for F01 SaaS purchase tracking on /setup/success.
 * Progressive per-channel fire, consent-aware, waits for late cookie banner accept.
 */

import {
  fireSaasPurchaseTracking,
  saasPurchaseDedupKey,
  saasPurchaseDedupKeyAds,
  saasPurchaseDedupKeyGa4,
  shouldTrackSaasPurchase,
  type PurchaseTrackingConsent,
} from './adsConversion';
import { CONSENT_CHANGED_EVENT } from '@/lib/consent/config';
import { readConsentPreferences } from '@/lib/consent/storage';

export type StartSaasPurchaseTrackingInput = {
  transactionId: string;
  value: number;
  adsSendTo: string | null;
  /** Poll interval while waiting for tags (ms). */
  pollMs?: number;
  /**
   * After this many polls with Ads still wanted+unconfigured, abandon Ads
   * so GA4 can complete alone (misconfig / failed Ads load).
   */
  adsAbandonAfterAttempts?: number;
};

export type StartSaasPurchaseTrackingHandle = {
  stop: () => void;
};

/** Default poll interval (ms). */
export const SAAS_PURCHASE_POLL_MS = 250;

/**
 * Default Ads wait budget: 80 × 250ms ≈ 20s before abandoning Ads so GA4 can finish alone.
 * Consent change resets the counter.
 */
export const SAAS_PURCHASE_ADS_ABANDON_AFTER_ATTEMPTS = 80;

function consentFromPrefs(): PurchaseTrackingConsent | null {
  const prefs = readConsentPreferences();
  if (!prefs) return null;
  return {
    analytics: prefs.analytics,
    advertisingMeasurement: prefs.advertisingMeasurement,
  };
}

/** True if key is marked in sessionStorage or localStorage (same-device multi-tab). */
function storageHasFired(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key) === '1') return true;
  } catch {
    /* private mode */
  }
  try {
    if (window.localStorage.getItem(key) === '1') return true;
  } catch {
    /* private mode / quota */
  }
  return false;
}

function storageMarkFired(key: string): void {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    /* fail-soft */
  }
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    /* fail-soft */
  }
}

function readAlreadyFired(transactionId: string): { ga4: boolean; ads: boolean } {
  const legacy = storageHasFired(saasPurchaseDedupKey(transactionId));
  return {
    ga4: legacy || storageHasFired(saasPurchaseDedupKeyGa4(transactionId)),
    ads: legacy || storageHasFired(saasPurchaseDedupKeyAds(transactionId)),
  };
}

function markFired(transactionId: string, channel: 'ga4' | 'ads'): void {
  const key =
    channel === 'ga4'
      ? saasPurchaseDedupKeyGa4(transactionId)
      : saasPurchaseDedupKeyAds(transactionId);
  storageMarkFired(key);
}

/**
 * Start purchase tracking. Safe to call once per success page load.
 * Listens for consent changes until complete, rejected optional, or pagehide.
 */
export function startSaasPurchaseTracking(
  input: StartSaasPurchaseTrackingInput,
): StartSaasPurchaseTrackingHandle {
  const pollMs = input.pollMs ?? SAAS_PURCHASE_POLL_MS;
  const adsAbandonAfterAttempts =
    input.adsAbandonAfterAttempts ?? SAAS_PURCHASE_ADS_ABANDON_AFTER_ATTEMPTS;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let adsWaitAttempts = 0;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
    window.removeEventListener('pagehide', onPageHide);
  };

  const tick = (): boolean => {
    if (stopped) return true;

    const consent = consentFromPrefs();
    if (!consent) {
      // No decision yet — keep waiting for banner.
      return false;
    }

    if (!shouldTrackSaasPurchase(consent)) {
      // Rejected optional (or both false) — stop cleanly.
      stop();
      return true;
    }

    if (typeof window.gtag !== 'function') return false;

    const already = readAlreadyFired(input.transactionId);
    const wantAds = Boolean(consent.advertisingMeasurement && input.adsSendTo);
    const adsConfigured = window.__kersivoAdsConfigured === true;

    if (wantAds && !already.ads && !adsConfigured) {
      adsWaitAttempts += 1;
    }

    const abandonAds =
      wantAds && !already.ads && !adsConfigured && adsWaitAttempts > adsAbandonAfterAttempts;

    const result = fireSaasPurchaseTracking({
      transactionId: input.transactionId,
      value: input.value,
      adsSendTo: input.adsSendTo,
      consent,
      gtag: window.gtag.bind(window),
      tagReady: {
        ga4Configured: window.__kersivoGa4Configured === true,
        adsConfigured,
      },
      alreadyFired: already,
      abandonAds,
    });

    if (result.firedGa4) markFired(input.transactionId, 'ga4');
    if (result.firedAdsConversion) markFired(input.transactionId, 'ads');

    if (result.complete) {
      stop();
      return true;
    }
    return false;
  };

  const onConsentChanged = () => {
    adsWaitAttempts = 0;
    tick();
  };

  const onPageHide = () => {
    stop();
  };

  window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
  window.addEventListener('pagehide', onPageHide);

  if (!tick()) {
    timer = setInterval(() => {
      tick();
    }, pollMs);
  }

  return { stop };
}
