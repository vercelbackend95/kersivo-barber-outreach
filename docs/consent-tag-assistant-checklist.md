# Consent Mode v2 — manual Tag Assistant checklist

Use a fresh Incognito window on https://kersivo.co.uk/ (or local preview).

## Before any choice

1. Open DevTools → Network; filter `google` / `collect` / `gtag`.
2. Confirm **no** `gtag/js` request until Accept / Analytics / Ads measurement is chosen (Basic mode).
3. In Tag Assistant (or `dataLayer`), confirm consent default:
   - `analytics_storage`: denied
   - `ad_storage`: denied
   - `ad_user_data`: denied
   - `ad_personalization`: denied
4. Banner visible; booking/nav still work.

## Reject optional

1. Click **Reject optional**.
2. No GA4/Ads scripts; reload keeps rejection (`kersivo_consent` cookie with both optional flags false).

## Analytics only

1. Cookie settings → enable Analytics only → Save.
2. `gtag/js` loads once; `analytics_storage` granted; ad_* remain denied.
3. No Google Ads `AW-` config unless `PUBLIC_GOOGLE_ADS_ID` is set **and** advertising measurement is on.

## Advertising measurement

1. Enable Advertising measurement (requires `PUBLIC_GOOGLE_ADS_ID` in Vercel to load a tag).
2. Expect `ad_storage` + `ad_user_data` granted; `ad_personalization` denied.
3. If Ads ID unset: preference may be saved but **no** Ads network request (expected launch blocker).

## Accept all / withdraw

1. Accept all → GA4 (+ Ads if configured) once; no duplicate `config` on SPA-less full navigations beyond single flags.
2. Withdraw → consent update denied; optional first-party `_ga*` cleared where possible; reload stays denied.

## Conversions (Purchase — F01)

Primary Google Ads conversion = paid £39 SaaS on `/setup/success` (not contact forms).

1. Consent: **Reject optional** → no `saas_subscription_paid` and no Ads `conversion`.
2. Consent: **Analytics** and/or **Advertising measurement** → after verified subscription success, wait until tags are configured (`__kersivoGa4Configured` / `__kersivoAdsConfigured` as needed), then:
   - With analytics: GA4 event `saas_subscription_paid` (`transaction_id`, `value`, `currency`).
   - With advertising measurement **and** `PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL` set: `gtag('event','conversion',{ send_to: 'AW-…/label', … })`.
3. Refresh success page does **not** double-fire (`sessionStorage` key `saas_subscription_paid:{transactionId}`). Dedup is set only after a successful fire (required tags ready).
4. Legacy setup-fee event `setup_deposit_paid` is **not** the live purchase signal when setup fees are off.

### Analytics-only consent (required Ads ops)

Many visitors enable **Analytics** but not **Advertising measurement**. In that case:
- Site fires GA4 `saas_subscription_paid` only (no Ads `send_to`).
- Ads still needs those purchases: **import** GA4 key event `saas_subscription_paid` into Google Ads as Purchase (same `transaction_id` as the website `send_to` tag for dedupe when both fire).

Without this import, analytics-only paid subscriptions are invisible to Ads.

### Env required for Ads `send_to`
- `PUBLIC_GOOGLE_ADS_ID` = `AW-XXXXXXXX` (loads Ads tag when advertising measurement is on).
- `PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL` = conversion label from Google Ads (the part after `/` in `AW-XXX/LABEL`, or paste full `AW-XXX/LABEL`).
