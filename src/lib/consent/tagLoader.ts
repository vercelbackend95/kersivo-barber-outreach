import type { ConsentPreferences } from './types';

declare global {
  interface Window {
    __kersivoGtagScriptLoaded?: boolean;
    __kersivoGa4Configured?: boolean;
    __kersivoAdsConfigured?: boolean;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export type TagLoaderIds = {
  gaMeasurementId: string;
  googleAdsId: string;
};

function ensureStub(): void {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  }
}

function loadGtagScript(primaryId: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.__kersivoGtagScriptLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-kersivo-gtag="1"]',
    );
    if (existing) {
      window.__kersivoGtagScriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryId)}`;
    script.dataset.kersivoGtag = '1';
    script.onload = () => {
      window.__kersivoGtagScriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load gtag.js'));
    document.head.appendChild(script);
  });
}

/**
 * Which Google tags this consent record and env allow. The Ads tag is needed both for measuring
 * conversions and for building remarketing audiences, so either advertising purpose loads it.
 */
export function resolveTagTargets(
  prefs: ConsentPreferences | null,
  ids: TagLoaderIds,
): { wantAnalytics: boolean; wantAds: boolean } {
  return {
    wantAnalytics: Boolean(prefs?.analytics && ids.gaMeasurementId),
    wantAds: Boolean(
      (prefs?.advertisingMeasurement || prefs?.personalisedAdvertising) && ids.googleAdsId,
    ),
  };
}

/**
 * Loads GA4 and/or Google Ads config at most once, only when consent + IDs allow it.
 * Basic Consent Mode: script is not requested until at least one optional purpose is granted.
 */
export async function syncTagsForConsent(
  prefs: ConsentPreferences | null,
  ids: TagLoaderIds,
): Promise<void> {
  if (typeof window === 'undefined') return;

  const { wantAnalytics, wantAds } = resolveTagTargets(prefs, ids);

  if (!wantAnalytics && !wantAds) return;

  ensureStub();

  const primaryId = wantAnalytics ? ids.gaMeasurementId : ids.googleAdsId;
  try {
    await loadGtagScript(primaryId);
  } catch {
    // Tag load failure must not break the site.
    return;
  }

  window.gtag!('js', new Date());

  if (wantAnalytics && !window.__kersivoGa4Configured) {
    window.gtag!('config', ids.gaMeasurementId, {
      anonymize_ip: true,
    });
    window.__kersivoGa4Configured = true;
  }

  if (wantAds && !window.__kersivoAdsConfigured) {
    window.gtag!('config', ids.googleAdsId);
    window.__kersivoAdsConfigured = true;
  }
}
