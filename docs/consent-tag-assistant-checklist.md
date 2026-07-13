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

## Conversions

1. `setup_deposit_paid` only after analytics consent and verified success page.
2. Refresh success page does not double-fire (sessionStorage dedup when consented).
