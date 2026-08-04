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

## Personalised advertising (remarketing)

1. Enable Personalised advertising only, leaving measurement off.
2. Expect `ad_personalization` granted, plus `ad_storage` + `ad_user_data` granted (Google needs both to build audiences).
3. The Ads tag loads on this consent alone, but purchase `conversion` hits stay gated behind advertising **measurement**.
4. Withdraw it → `ad_personalization` denied on the next consent update; audiences already built expire per their Google membership duration.

## Accept all / withdraw

1. Accept all → GA4 (+ Ads if configured) once; no duplicate `config` on SPA-less full navigations beyond single flags.
2. Withdraw → consent update denied; optional first-party `_ga*` cleared where possible; reload stays denied.

## Conversions (Purchase — F01)

Primary Google Ads conversion = paid £39 SaaS on `/setup/success` (not contact forms).

**Google Ads Website conversion (canonical):** Category Purchase; Action optimisation **Primary**; **Count = Every**; value = different values for each conversion (tag sends verified monthly amount + **GBP**); tag includes `transaction_id` (Stripe id) so repeats are not recounted **within this action**. Exactly **one** Primary Purchase — the Website/`send_to` tag.

1. Consent: **Reject optional** → no `saas_subscription_paid` and no Ads `conversion`.
2. Consent: **Analytics** and/or **Advertising measurement** → after verified subscription success, wait until tags are configured (`__kersivoGa4Configured` / `__kersivoAdsConfigured` as needed), then **progressive** per channel:
   - With analytics: GA4 event `saas_subscription_paid` (`transaction_id`, `value`, `currency`) as soon as GA4 is configured (does not wait for Ads).
   - With advertising measurement **and** `PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL` set: `gtag('event','conversion',{ send_to: 'AW-…/label', … })` when Ads is configured.
3. If the cookie banner is still open on success, accept preferences **on that page** (Tag Assistant). The success script listens for `kersivo:consent-changed` until `pagehide` — late accept still fires.
4. Refresh success page does **not** double-fire (per-channel `sessionStorage`: `saas_subscription_paid:ga4:{transactionId}` / `…:ads:…`). Dedup is set only after that channel successfully fires. That client dedup is separate from Ads conversion-action counting.
5. Legacy setup-fee event `setup_deposit_paid` is **not** the live purchase signal when setup fees are off.

### Analytics-only consent (Ads ops)

Many visitors enable **Analytics** but not **Advertising measurement**. In that case the site fires GA4
`saas_subscription_paid` only (no Ads `send_to`), so those purchases are invisible to the Website tag path.

A GA4 import into Ads is **optional**. Do **not** close the analytics-only gap by importing the GA4 key event as a second **Primary** Purchase action. Google Ads does not
dedupe across separate conversion actions, so a tag conversion plus a GA4 import both marked Primary counts one £39 subscription twice and
inflates ROAS. Keep exactly one Primary Purchase action (the Website tag) and leave any GA4-sourced action **Secondary / observe only**.
`transaction_id` helps within a single conversion action; it is **not** a guarantee of cross-action deduplication.
Consent Mode modelling already recovers part of the unmeasured traffic.

### Env required for Ads `send_to`
- `PUBLIC_GOOGLE_ADS_ID` = `AW-XXXXXXXX` (loads Ads tag when advertising measurement is on).
- `PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL` = conversion label from Google Ads (the part after `/` in `AW-XXX/LABEL`, or paste full `AW-XXX/LABEL`).
