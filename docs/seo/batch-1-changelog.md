# Batch 1 changelog — truth and safety

Branch: `seo/batch-1-truth-safety`. Copy and markup only. `/seo-growth` was not edited.

## Task 1 — KERSIVO Assistant

URLs: `/pricing`, `/starter`, `/booksy-alternative`, `/fresha-alternative`, `/treatwell-alternative`, `/nearcut-alternative`, `/setora-alternative`, `/phorest-alternative`, `/square-alternative`, `/vagaro-alternative`. Also the Full plan card in onboarding and the assistant upsell in the admin panel.

- Plan-card and pricing list item: `Live KERSIVO Assistant` → `KERSIVO Assistant — AI guidance on using KERSIVO and running your shop`
- Prose (pricing FAQ, Starter upgrade answer, each alternative pricing paragraph): `the live KERSIVO Assistant` → `the KERSIVO Assistant, an AI helper for guidance on using KERSIVO and running your shop`
- Admin upsell: `Activate the live KERSIVO Assistant with Full KERSIVO.` → `The KERSIVO Assistant — AI guidance on using KERSIVO and running your shop — is included with Full KERSIVO.`

`src/pages/terms.astro` still says “the live KERSIVO Assistant”. Left for founder sign-off. “Live KERSIVO demo” was not changed.

## Task 2 — Legal footer

URLs: `/terms`, `/privacy`, `/cookies`, `/dpa` (shared `LegalFooter` only; body text unchanged).

- Heading: `Your booking. Your brand. Zero KERSIVO commission.` → `Your brand. Your bookings. 0% KERSIVO commission.`
- Description: `Whether you are switching from a marketplace profile or starting your first system, we set you up in about two weeks — with 0% KERSIVO commission on bookings and retail.` → `Full KERSIVO is £39/month per location. Your website is typically ready 1–2 weeks after we receive all required information. Standard Stripe processing fees apply to online payments.` (£39 comes from `SAAS_MONTHLY_GBP`.)
- CTA: `PLAN MY SETUP` → `/#pricing` → `See pricing` → `/pricing`. Analytics event `plan_my_setup_click` unchanged.
- Nav: Pricing `/#pricing` → `/pricing`. FAQ and Contact unchanged.

## Task 3 — Meta descriptions

- `/pricing`: `KERSIVO pricing: Starter £0/month with £5 deposits or full payment. Full £39/month per location adds your website, domain and payment control. 0% commission.` → `Full KERSIVO is £39/month per location with your website, domain and online booking. No setup fee, no VAT added. Starter is £0/month. Stripe fees apply.` (152 characters)
- `/about`: `Booking software for independent UK barbershops. Starter is £0/month; Full KERSIVO is £39/month with your own website, domain and retail. 0% commission.` → `Booking software and branded websites for independent UK barbershops. Full KERSIVO is £39/month per location; Starter is £0/month. Stripe fees apply.` (149 characters)

Titles and the OG image were not changed.

## Task 4 — Client data export on `/compare`

Second sentence of the KERSIVO hub row: `This export is requested through support, not downloaded from a self-service dashboard.` → `Full KERSIVO owners can also download it once from the dashboard settings.`

`DATA_EXPORT_RETENTION_CLAIM`, Terms and the DPA were not edited. `src/lib/seo/alternativesHubSeo.ts` still says some other platforms’ exports “are requested through support”. That sentence is about other platforms, not a KERSIVO support-only claim, so it was left.

## Task 5 — `/barbershop-online-booking`

- H2: `Booking Confirmations and What Comes Next.` → `Booking confirmations and reminders`
- Lead: the planned thank-you, review and rebook showcase was removed. The section now says KERSIVO sends booking confirmation emails and appointment reminders, that clients can use the confirmation-email links to request a change or cancellation subject to shop policies, and links to `/pricing#plan`.
- Deleted `src/lib/barbershopOnlineBooking/afterBookingExample.ts` and its test. Showcase CSS was removed; the section, header and demo CTA styles remain.

## Task 6 — Homepage switcher

URL: `/` (and any page that renders `landingSwitcherReassurance` with the compare-link props).

Lead: `Already using Booksy, Fresha, Setora or another booking platform?` (only Setora linked) → `Already using Booksy, Fresha, Treatwell, Setora or another booking platform? Keep taking bookings through your current system while we prepare your branded KERSIVO setup.` Booksy, Fresha, Treatwell and Setora each link to their alternative page when the matching prop is on. The “Before you switch…” sentence and the single `/compare` nav row are unchanged.

## Task 7 — Viewport

`LandingLayout` and `MainLayout`: `width=device-width` → `width=device-width, initial-scale=1`. `DemoLayout`, `MinimalLayout` and `facebook-cover.astro` were not touched.

## Task 8 — Dead components and claims guard

Deleted unused marketing components and the CSS that only they imported: `audiencePicker`, `brandValues`, `compare3`, `cta10`, `feature228`, `hero108`, `insideSystemHome`, `landingDemoCapture`, `landingIncludedChecklist`, `migrationGuide`, `newcomerPath`, `settingsIntegrations3a`, `stats10`, `timeline13`, `trustBlock`, `hero227`, `process2`, `trustStrip3`.

`faqItems.ts` was removed. Every live `Faq4` usage passes `faqs` explicitly, so the default is now an empty array. `faqJsonLd.ts` no longer imports that file and returns an empty FAQ list. `compare3.css` and `hero227.css` stay, because `pricing36.tsx` / `LaunchWizard.tsx` and `facebook-cover.astro` still import them. `compare3Table.astro` and `HeroHeadlineLines.tsx` are now unused and were left, because they were not on the delete list.

`scripts/claims-guard.mjs` runs as `npm run claims:check` and at the start of `npm run build`. Allowlist covers Nearcut’s own “zero commission” and “unlimited SMS” facts, and the banned-phrase comment in `claimsPolicy.ts`.

Remaining guard hits that were rewritten:

- `PLAN_SCOPE_HIGHLIGHTS`: `Email and SMS confirmations and reminders` → `Email confirmations and reminders, plus SMS reminders within a monthly allowance`. This string feeds the default rate card, which is not mounted on `/`, `/pricing` or the alternative pages. Those pages use the landing offer, whose included line already says “email confirmations and SMS appointment reminders”. Checked that landing card at 375px and 1440px: no horizontal overflow; the reminders line wraps inside its column.
- `pricing36Copy.ts` default and landing headlines: `ONE MONTHLY FEE. ZERO KERSIVO COMMISSION.` → `ONE MONTHLY FEE. 0% KERSIVO COMMISSION.`
- `pricing36Copy.ts` default newcomer anchors: `Live booking on your own domain in about two weeks.` → `Your site is typically ready 1–2 weeks after we receive all required information.`
- `/square-alternative` payments lead: `Shop-connected Stripe payments and zero KERSIVO commission.` → `Shop-connected Stripe payments and 0% KERSIVO commission. Stripe fees apply.`

`SHOW_SETUP_PLAN_CARDS` is false, so the Pricing36 strings are not on a public page today.

The landing Pricing36 anchors still say `Typical go-live: around two weeks after onboarding.` They did not match the “Live booking… about two weeks” text in the brief, and “around two weeks” is not a guard pattern, so they were left.

`scripts/convert-zero-illustration-webp.mjs` and `scripts/compose-happy-bubble.mjs` still mention `brandValues.astro` in comments. Those are not imports.
