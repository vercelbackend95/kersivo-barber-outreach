# Batch 4 changelog — comparison engine

Branch: `seo/batch-4-comparison-engine`, from `main` at `751b0e6`. Pages: `/compare`, `/barber-software-cost-calculator` and the 10 alternatives. Homepage, `/pricing`, legal pages, `/seo-growth`, Prisma/booking/payment code, `vercel.json` and analytics were not touched. No figure or checked date in `src/lib/seo/*Facts.ts` was changed.

## Task 1 — one shared closing CTA

- New `src/components/comparison/ComparisonFinalCta.astro` (copy in `src/lib/seo/comparisonCtas.ts`). Props: `placement` and an optional `competitor`.
- Before: “Ready for a more direct booking relationship?” (wording varied per page) · primary “Start KERSIVO Starter” → `/admin` (`starter_signup_click`) · secondary button “Compare Starter and Full” → `/pricing`.
- After: H2 “Ready to move your bookings onto your own website?” · sub “Full KERSIVO is £39/month per location, with your branded website, domain and online booking. 0% KERSIVO commission. Standard Stripe payment-processing fees still apply.” · primary “Start Full KERSIVO — £39/month” → `/admin/launch` (`saas_subscribe_click`, `{placement}_final`) · text link “Only need bookings for up to 4 barbers? Start on Starter (£0/month) →” `/starter` (`starter_plan_explore_click`) · text link “Ask us about switching from {Competitor} →” `#contact`.
- `/compare` and the calculator have no `#contact` section, so they render without the switching link. The calculator had no closing CTA before; it now has one after the FAQ.
- Removed: `BooksyFinalCta`, `FreshaFinalCta`, `NearcutFinalCta`, `PhorestFinalCta`, `SetoraFinalCta`, `SquareFinalCta`, `SquireFinalCta`, `TimelyFinalCta`, `TreatwellFinalCta`, `VagaroFinalCta`, `HubFinalCta`. `src/components/timelyAlternative/` now holds only `TimelyCompare.astro`.

## Task 2 — hero CTAs

- New `src/components/comparison/ComparisonHeroActions.astro` + `src/styles/components/comparison-hero-actions.css`.
- Before (alternatives): “See KERSIVO in Action” / “Open the full demo” → `/demo` · “Compare KERSIVO and {X}” → `#comparison`. `/compare` and the calculator had no hero CTA.
- After (all 12 pages): “See Full KERSIVO pricing” → `/pricing#plan` (`view_pricing_click`) · “See it working” → `/demo` (`view_live_demo_click` kept). Both carry `data-track-placement="{page}_hero"` (`booksy`, `fresha`, `treatwell`, `nearcut`, `vagaro`, `timely`, `phorest`, `square`, `squire`, `setora`, `compare_hub`, `cost_calculator`).
- Shared fix: hero meta “0% KERSIVO commission (on booking payments)” → adds “(Stripe fees apply)” on all 10 alternatives.

## Task 3 — `/compare`

- Title: “Compare 11 Barber Booking Systems in the UK | KERSIVO” → “Best Barber Booking Software UK: 11 Systems Compared” (52).
- Description shortened to 150 characters (was 158): “…and KERSIVO. Explore pricing…” → “…and KERSIVO: pricing…”.
- Lead under the H1 replaced by the roadmap direct answer (3 sentences). The old “Compare 11 booking systems…” lead moved to the sub line; “Built for independent UK barbershops…” removed.
- New FAQ “Booksy or Fresha: which is better for a barbershop?”, built from `booksyFacts.ts` / `freshaFacts.ts`: 5-person subscription (£60 vs £49.75 + VAT), Fresha Marketplace fee vs optional Booksy Boost, online card rates, both checked dates. FAQ JSON-LD renders from the same list (7 items).
- Methodology and “not an independent ranking” text unchanged. Last updated 9 → 28 October 2026.

## Task 4 — tier-1 alternatives

All four already had a team-size or cost section and a “{Competitor} may suit your shop if…” block, so no new fit block was added.

- **Booksy:** title “Booksy Alternative for UK Barbershops | KERSIVO” → “Booksy Alternative UK: No Per-Barber Fees | KERSIVO”. New FAQ “Can clients book Booksy without the app?” (Booksy Help Centre `customerApp` source + listed booking channels). “Do clients need to download an app to book?” now opens with “No. KERSIVO has no customer app: clients book in the browser…” and names the trade-off (no app or marketplace discovery). “…SMS and the live Assistant” → approved wording. Last updated → 28 October 2026.
- **Treatwell:** title “Treatwell Alternative UK | Pricing & Fees | KERSIVO” → “Treatwell Alternative UK: No New-Client Commission | KERSIVO” (60). “How much commission does Treatwell charge in the UK?” → “How much does Treatwell charge?” (commission, repeat/direct, prepayment, Tap to Pay/card machine, £199 terminal, quote-based subscription). New table “Published commission per month: a worked example” (5/10/20 eligible bookings at £25 → £43.75 / £87.50 / £175 + VAT) from `estimateTreatwellPublishedBookingFees`. A team-size table is not possible: the monthly subscription is `unresolved`. Every 35% / 0% / 2.5% / £39 / £5 in `treatwellAlternativeContent.ts` and `treatwellAlternativeFaq.ts` now comes from facts or constants. Last updated → 28 October 2026.
- **Fresha:** title → “Fresha Alternative UK: Own Website & Flat Price | KERSIVO”. New FAQ “Is Fresha no longer free?” (current paid plans, Enterprise threshold, £0 on direct links, Marketplace fee). It does not say when or whether a free plan was withdrawn. “live Assistant” wording fixed. Last updated → 28 October 2026.
- **Nearcut:** title unchanged (no roadmap title). No team-size table: the subscription price is `unresolved`. £1.50, £39 and £5 in content, FAQ and `NearcutCosts.astro` now come from facts or constants. Last updated → 28 October 2026.

## Task 5 — tier-2

Vagaro, Timely, Phorest, Square, SQUIRE, Setora: shared CTA, hero CTAs and the hero Stripe note only. No title changes (no ranking data in the repo to justify them).

## Task 6 — calculator worked examples

- Removed `COST_SCENARIOS` and “Scenario figures will be generated by the calculation engine…”.
- New `src/lib/costCalculator/costScenarios.ts`: 1/3/5/8 barbers, 130 appointments per barber, £25 average, direct bookings only, not VAT registered, no add-ons or deposit processing. Each table comes from `buildCalculatorView` (the same pipeline as the interactive results).
- `costScenarios.test.ts` checks that every row equals `calculateMonthlyCosts` (formatted total, or Custom pricing).
- Results (monthly cash): Booksy £48 / £60 / £72 / £90; Fresha £17.94 / £35.82 / £59.70 / £95.52; Setora £59; Vagaro £20 / £40 / £60 / £80; Nearcut and Square £0; Timely, Treatwell and Phorest Custom pricing; KERSIVO (Full) £39.
- The note explains the inputs, the Nearcut client charge and that KERSIVO figures are Full.

## Task 7 — competitor figures

No figure or checked date in `*Facts.ts` changed. All checked dates are within 90 days (oldest: Fresha, 30 September 2026).

## Tests

- New: `src/lib/seo/comparisonCtas.test.ts`, `src/lib/costCalculator/costScenarios.test.ts`.
- Updated for intended changes: alternatives hub (title, FAQ count, description ≤155), hub discovery, Booksy/Fresha (titles, FAQ counts, dates, hero/CTA source), Nearcut (deposit constant), Timely (shared components), Treatwell and marketing sitemap (lastmod), calculator page (scenario check), plus the order arrays in all alternative tests.

## Verification

- `npm run claims:check`: pass.
- `npm run typecheck`: 0 errors.
- `npm test`: 5057 passed, 3 failed. `financialEndpoints` MANAGER 403 is the known timeout and passed when run alone. `blacklineDemoCtas` (“fallbackBrandMark="CS"”) and `storefrontThemeIsolation` (“addToBagShortLabel="Add"”) also fail when run alone. They read `DeferredWidget.tsx` / `RetailDemoRail.tsx`, which changed in #130 on `main` and which this branch does not touch. These failures exist on `main` already.
- `npm run build`: `prisma generate` failed (EPERM) because a local `npm run dev` (not started by this session) held the Prisma engine. `claims-guard`, `insights/check-all` and `astro build` were run separately and completed.
- Server HTML (dev server) of all 12 pages: one `<h1>`; the first tracked link is `/pricing#plan`, then `/demo`; the closing CTA has `/admin/launch` before `/starter`; Starter is never a button; the switching link is on all 10 alternatives; no `/#pricing`; every FAQPage question and answer is visible; no demo fixture strings.
- Sitemap (50 URLs): titles and descriptions are unique. Batch 4 pages are all ≤60 / ≤155. Out of scope and over the limit: `/starter` (desc 159), `/barbershop-website-design` (157), Insights `making-tax-digital-barbers` (157), `barbershop-loyalty-scheme-uk` (157), `do-barbers-need-a-website-uk` (156), `barber-commission-pay-minimum-wage-uk` (159), and the known 64-character Insights title.
- Screenshots at 375 and 1440 (`/compare`, `/booksy-alternative`, `/treatwell-alternative`, calculator; top, closing CTA, tables) are in `docs/seo/batch-4-screenshots/`, not in git. Horizontal overflow 0px on all.

## Not verified

- Vercel previews: see the PR.
- Production build including `prisma generate` was not run locally (see above).

## Facts and decisions needed from the founder

1. **Booksy app answer:** relies on the `customerApp` source entry (“booking without the Booksy for Customers app”). Please confirm the Help Centre article still says clients can book without the app, or add an explicit fact.
2. **Fresha “no longer free”:** no fact on whether or when Fresha had a free plan. The answer only states the current paid plans.
3. **Treatwell monthly subscription** and **Nearcut Subscription price** are `unresolved`, so team-size cost tables are not possible on those pages.
4. **Hand-typed figures in facts files:** `TREATWELL_COMPARE_SECTIONS` (35%, 2.5%, £39) and `NEARCUT_COMPARE_SECTIONS` (£1.50, £39) contain typed strings inside the facts files. They were left alone because those files must not change.
5. **Tier-2 hand-typed competitor figures** (not changed): Vagaro FAQ 20%; Square content/FAQ/costs/hero £29, £69, 1.4%, 1.6%, 1.75%, 2.5%; Setora FAQ/sources £59; Timely FAQ/page 1.85%, £15, £20.
6. **Pricing sections** on all alternatives still open with the Starter-first H2 “Start free. Upgrade per location when you need more.” This is not in the Batch 4 list. Decide whether it should be Full-first.
7. The calculator models KERSIVO as Full (£39) even for 1–4 barbers. Starter is mentioned in the note only.
