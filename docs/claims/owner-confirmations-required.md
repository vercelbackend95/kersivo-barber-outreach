# Owner confirmations & legal review — Claims Audit remediation

**Status:** Commercial Point 2 confirmed 13 July 2026 — public copy updated  
**Related:** Competitor Claims Audit; align pricing and service terms  
**§2 refresh (21 Jul 2026):** Public VAT wording now uses “You pay exactly the price shown…” from `claimsPolicy.ts`. Care-from-go-live below is **legacy setup-fee path** (gated off); live SaaS bills from purchase day per Commercial Offer v1.0 §2.

## 1. VAT treatment (OWNER) — CONFIRMED

KERSIVO is **not VAT registered**. The customer pays exactly the listed price (currently £39/month for SaaS). No VAT is added. Do not say “including VAT”.

Public wording (source of truth):

> You pay exactly the price shown. KERSIVO is not currently VAT registered, so no VAT is added.

Source: [`src/lib/pricing/claimsPolicy.ts`](../src/lib/pricing/claimsPolicy.ts)

## 2. SMS under Ongoing Care (OWNER) — CONFIRMED

**Unlimited automated SMS appointment reminders included.** No fair-use, surcharges or customer-facing limits in public copy.

Public wording (source of truth): `SMS_INCLUDED_CLAIM` in [`src/lib/pricing/claimsPolicy.ts`](../src/lib/pricing/claimsPolicy.ts). Wired on RateCard1 highlights, Terms, FAQ and AI (21 Jul 2026). Product integration remains WP-F.

## 3. Care from go-live — LEGACY (setup-fee path)

> **STALE for live SaaS:** When `SHOW_SETUP_PLAN_CARDS` is false, subscription starts on the day of purchase (first payment immediate), not at go-live.

Legacy setup-fee path (code still present, gated off): £39/month from go-live, auto-billed; no minimum term / notice; active to end of paid month; then website, booking, admin and retail offline.

## 4. Legal review — ASA / CAP / Google Ads (LEGAL)

Still recommended before Ads launch:

- [ ] Category-level marketplace comparisons
- [ ] Commission + Stripe qualifications
- [ ] Ownership / licence wording in Terms
- [ ] Any future named-competitor comparisons

## 5. Form options naming Booksy / Fresha (OWNER)

Contact and setup-deposit forms still offer **Booksy / Fresha** as current-stack options (operational taxonomy).

- [ ] Keep as-is, or replace with generic labels

## 6. Evidence recheck cadence

While Ads run: re-verify official Booksy UK pricing **monthly** before any competitor-named creative.

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Owner (VAT / SMS / Care) | Confirmed | 13 Jul 2026 | Commercial rules applied in copy |
| §2 SaaS / VAT copy refresh | | 21 Jul 2026 | claimsPolicy + Terms/FAQ/landing alignment |
| SMS public claim restored | | 21 Jul 2026 | `SMS_INCLUDED_CLAIM` on pricing/Terms/FAQ/AI |
| Legal / CAP review | | | Still open |
| Ads launch allowed | | | After legal row if required |
