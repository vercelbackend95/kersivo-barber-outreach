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
 * Prefer progressive fire via `fireSaasPurchaseTracking` — this is for all-ready checks.
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
  /** Channels already recorded in sessionStorage — skip re-fire. */
  alreadyFired?: { ga4?: boolean; ads?: boolean };
  /**
   * When true, stop waiting for Ads (misconfig / deadline). GA4 can still complete alone.
   * Has no effect if Ads was never wanted.
   */
  abandonAds?: boolean;
};

export type FireSaasPurchaseTrackingResult = {
  /** True if GA4 event was sent on this call. */
  firedGa4: boolean;
  /** True if Ads conversion was sent on this call. */
  firedAdsConversion: boolean;
  /** Still waiting for GA4 tag (wanted, not fired, not abandoned). */
  pendingGa4: boolean;
  /** Still waiting for Ads tag (wanted, not fired, not abandoned). */
  pendingAds: boolean;
  /** All wanted channels either fired or abandoned — safe to stop orchestrator. */
  complete: boolean;
};

/**
 * Progressive fire: send each ready channel independently.
 * Does not block GA4 on Ads readiness. Stub `gtag` alone is not enough —
 * wait for `__kersivoGa4Configured` / `__kersivoAdsConfigured` per channel.
 */
export function fireSaasPurchaseTracking(
  input: FireSaasPurchaseTrackingInput,
): FireSaasPurchaseTrackingResult {
  const empty: FireSaasPurchaseTrackingResult = {
    firedGa4: false,
    firedAdsConversion: false,
    pendingGa4: false,
    pendingAds: false,
    complete: false,
  };

  if (!shouldTrackSaasPurchase(input.consent)) {
    return empty;
  }

  const targets = resolvePurchaseTrackingTargets(input.consent, input.adsSendTo);
  if (!targets.wantGa4 && !targets.wantAdsConversion) {
    return empty;
  }

  const tagReady = input.tagReady ?? { ga4Configured: true, adsConfigured: true };
  const already = input.alreadyFired ?? {};
  const currency = input.currency ?? 'GBP';
  const abandonAds = Boolean(input.abandonAds);

  let firedGa4 = false;
  let firedAdsConversion = false;
  const ga4Done = Boolean(already.ga4);
  const adsDone = Boolean(already.ads);

  if (targets.wantGa4 && !ga4Done && tagReady.ga4Configured) {
    input.gtag('event', 'saas_subscription_paid', {
      transaction_id: input.transactionId,
      value: input.value,
      currency,
      transport_type: 'beacon',
    });
    firedGa4 = true;
  }

  if (
    targets.wantAdsConversion &&
    !adsDone &&
    !abandonAds &&
    tagReady.adsConfigured &&
    input.adsSendTo
  ) {
    input.gtag('event', 'conversion', {
      send_to: input.adsSendTo,
      value: input.value,
      currency,
      transaction_id: input.transactionId,
      transport_type: 'beacon',
    });
    firedAdsConversion = true;
  }

  const ga4Satisfied = !targets.wantGa4 || ga4Done || firedGa4;
  const adsSatisfied =
    !targets.wantAdsConversion || adsDone || firedAdsConversion || abandonAds;

  return {
    firedGa4,
    firedAdsConversion,
    pendingGa4: targets.wantGa4 && !ga4Satisfied,
    pendingAds: targets.wantAdsConversion && !adsSatisfied,
    complete: ga4Satisfied && adsSatisfied,
  };
}

/** Per-channel sessionStorage keys (refresh-safe dedup). */
export function saasPurchaseDedupKeyGa4(transactionId: string): string {
  return `saas_subscription_paid:ga4:${transactionId}`;
}

export function saasPurchaseDedupKeyAds(transactionId: string): string {
  return `saas_subscription_paid:ads:${transactionId}`;
}

/** @deprecated Prefer per-channel keys; kept for older sessionStorage entries. */
export function saasPurchaseDedupKey(transactionId: string): string {
  return `saas_subscription_paid:${transactionId}`;
}
