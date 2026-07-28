/**
 * Google Ads purchase conversion helpers (F01).
 * Primary Ads conversion = paid £39 SaaS on /setup/success.
 */

export type AdsPurchaseEnv = {
  googleAdsId?: string | null;
  purchaseConversionLabel?: string | null;
};

function trimEnv(value: string | null | undefined): string {
  return (value ?? '').toString().trim();
}

/** Normalize AW id — accepts `AW-123` or bare `123`. */
export function normalizeGoogleAdsId(raw: string | null | undefined): string | null {
  const trimmed = trimEnv(raw);
  if (!trimmed) return null;
  if (/^AW-/i.test(trimmed)) return `AW-${trimmed.slice(3)}`;
  if (/^\d+$/.test(trimmed)) return `AW-${trimmed}`;
  return null;
}

/**
 * Build `send_to` for gtag conversion.
 * Label is the part after `/` from Ads UI (`AW-XXX/LABEL` → pass LABEL only, or full send_to).
 */
export function buildGoogleAdsPurchaseSendTo(env: AdsPurchaseEnv): string | null {
  const labelRaw = trimEnv(env.purchaseConversionLabel);
  if (!labelRaw) return null;

  // Allow pasting full send_to accidentally.
  if (/^AW-\d+\/.+/i.test(labelRaw)) {
    return labelRaw;
  }

  const adsId = normalizeGoogleAdsId(env.googleAdsId);
  if (!adsId) return null;

  const label = labelRaw.replace(/^\//, '');
  if (!label || !/^[\w-]+$/.test(label)) return null;
  return `${adsId}/${label}`;
}

/** Read from import.meta / process env (Astro server + Vite). */
export function resolveGoogleAdsPurchaseSendToFromProcessEnv(): string | null {
  const googleAdsId =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_GOOGLE_ADS_ID) ||
    (typeof process !== 'undefined' ? process.env.PUBLIC_GOOGLE_ADS_ID : '') ||
    '';
  const purchaseConversionLabel =
    (typeof import.meta !== 'undefined' &&
      import.meta.env?.PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL) ||
    (typeof process !== 'undefined'
      ? process.env.PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL
      : '') ||
    '';

  return buildGoogleAdsPurchaseSendTo({
    googleAdsId: String(googleAdsId),
    purchaseConversionLabel: String(purchaseConversionLabel),
  });
}

export type PurchaseTrackingConsent = {
  analytics: boolean;
  advertisingMeasurement: boolean;
};

export function shouldTrackSaasPurchase(consent: PurchaseTrackingConsent): boolean {
  return Boolean(consent.analytics || consent.advertisingMeasurement);
}

/** Which purchase hits we intend to send for this consent + env. */
export function resolvePurchaseTrackingTargets(
  consent: PurchaseTrackingConsent,
  adsSendTo: string | null,
): { wantGa4: boolean; wantAdsConversion: boolean } {
  return {
    wantGa4: Boolean(consent.analytics),
    wantAdsConversion: Boolean(consent.advertisingMeasurement && adsSendTo),
  };
}

export type PurchaseTagReadyFlags = {
  ga4Configured: boolean;
  adsConfigured: boolean;
};

/**
 * True when every *wanted* channel has its gtag config flag set.
 * Stub `gtag` alone is not enough — wait for `__kersivoGa4Configured` / `__kersivoAdsConfigured`.
 */
export function arePurchaseTagsReady(
  targets: { wantGa4: boolean; wantAdsConversion: boolean },
  flags: PurchaseTagReadyFlags,
): boolean {
  if (!targets.wantGa4 && !targets.wantAdsConversion) return false;
  if (targets.wantGa4 && !flags.ga4Configured) return false;
  if (targets.wantAdsConversion && !flags.adsConfigured) return false;
  return true;
}

export type FireSaasPurchaseTrackingInput = {
  transactionId: string;
  value: number;
  currency?: string;
  /** When set, also fires Google Ads `conversion` with send_to. */
  adsSendTo: string | null;
  consent: PurchaseTrackingConsent;
  gtag: (...args: unknown[]) => void;
  /** When omitted, assumes tags already ready (tests / callers that gated earlier). */
  tagReady?: PurchaseTagReadyFlags;
};

/**
 * Fire GA4 purchase event and/or Ads conversion.
 * Returns `complete: true` only when all wanted channels fired (safe to dedupe).
 * If tags are not ready, returns complete:false and fires nothing.
 */
export function fireSaasPurchaseTracking(input: FireSaasPurchaseTrackingInput): {
  firedGa4: boolean;
  firedAdsConversion: boolean;
  complete: boolean;
} {
  if (!shouldTrackSaasPurchase(input.consent)) {
    return { firedGa4: false, firedAdsConversion: false, complete: false };
  }

  const targets = resolvePurchaseTrackingTargets(input.consent, input.adsSendTo);
  if (!targets.wantGa4 && !targets.wantAdsConversion) {
    return { firedGa4: false, firedAdsConversion: false, complete: false };
  }

  const tagReady = input.tagReady ?? { ga4Configured: true, adsConfigured: true };
  if (!arePurchaseTagsReady(targets, tagReady)) {
    return { firedGa4: false, firedAdsConversion: false, complete: false };
  }

  const currency = input.currency ?? 'GBP';
  let firedGa4 = false;
  let firedAdsConversion = false;

  if (targets.wantGa4) {
    input.gtag('event', 'saas_subscription_paid', {
      transaction_id: input.transactionId,
      value: input.value,
      currency,
      transport_type: 'beacon',
    });
    firedGa4 = true;
  }

  if (targets.wantAdsConversion && input.adsSendTo) {
    input.gtag('event', 'conversion', {
      send_to: input.adsSendTo,
      value: input.value,
      currency,
      transaction_id: input.transactionId,
      transport_type: 'beacon',
    });
    firedAdsConversion = true;
  }

  return {
    firedGa4,
    firedAdsConversion,
    complete: (targets.wantGa4 ? firedGa4 : true) && (targets.wantAdsConversion ? firedAdsConversion : true),
  };
}

/** sessionStorage key for purchase dedup on /setup/success. */
export function saasPurchaseDedupKey(transactionId: string): string {
  return `saas_subscription_paid:${transactionId}`;
}
