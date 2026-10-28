# Batch 3 changelog — homepage, pricing, Full first

Branch: `seo/batch-3-homepage-pricing`, from `origin/main` at `66e8a18b`.

## Fix 1 — live widgets, no demo text in the HTML

The still images looked soft. The admin timeline, booking flow, retail carousel and reports studio are the original React widgets again, inside `DeferredWidget`. The server HTML is an empty sized box (`data-nosnippet`). Each island uses `client:visible` with a 200px root margin. Timeline, booking and reports are frozen at every width (`forcePassive`); the retail carousel still scrolls. Captions stay “Example shop – fictional data”. The homepage does not query the database: the widgets import the existing static fixtures inside the client bundle. Stills and `scripts/capture-landing-demo-stills.mjs` are removed.

Reserved heights were measured at 375, 768 and 1440. At 375 the reports box is 343/573; the other three boxes match their content. Clicks on the timeline do not open the preview lock. The carousel `scrollLeft` moves.

## Fix 2 — six difference tiles on desktop

The four Batch 3 pillars stay in order on every screen. “More control behind the chair.” and “Build direct client relationships.” are tiles 3 and 4 from 768px up (`users-four`, `address-book`) and `display: none` below that. Desktop is 3 columns, so the six tiles read as 3 × 2. At 375px, 4 tiles are visible. At 1440px, 6 are visible.

## Lighthouse

Same method as the Batch 3 baseline: local `npm run dev`, because `astro preview` is unsupported. Mobile `/` after these fixes, warm run: performance 54, accessibility 91, LCP 5.5 s, CLS 0. CLS stays 0. Performance is 34 points under the stills result of 88. On this dev server Vite inlines the widget stylesheets into the first HTML response, so the score is not a production figure. The stills page did not include those stylesheets.

| Page | Form | Before Batch 3 | After stills | After live widgets |
| --- | --- | --- | --- | --- |
| `/` | mobile | 47 / a11y 84 / CLS 0 | 88 / a11y 91 / CLS 0 | 54 / a11y 91 / CLS 0 |

## Self-check

- `claims:check` passed. `typecheck` passed. `npm run build` passed after the dev server released the Prisma engine file.
- `npm test`: 2 failed / 578 files passed in the full run. `financialEndpoints` MANAGER 403 timed out, and `ClientOnboardingWizard` “Hours failed” did not appear in time. Both files passed when run alone (42 tests).
- Server HTML of `/`: one `h1`, and it is the first heading in `main`. No demo fixture strings and no widget headings. The seven body links are present. FAQPage JSON-LD matches the 10 visible questions and answers. The Full offer is first at 39.00 GBP with `billingDuration` P1M. The Booksy example shows £60, £72 and 2 October 2026.
- `/booksy-alternative` and `/fresha-alternative` server HTML contain none of the demo fixture strings.
- `/pricing`: H1 unchanged. `#plan` starts with Full. No heading contains “Start on Starter”. Pricing FAQ JSON-LD matches the visible questions.
- `/barbershop-websites` title is “Barbershop Website with Online Booking UK | KERSIVO”. The first hero button is “Start Full KERSIVO — £39/month”.
- 50 sitemap URLs: titles are unique. One title is over 60 characters and was left unchanged because it is an existing Insights article, outside this batch: `/insights/google-business-profile-booking-link-barbershop` (“Google Business Profile Booking Link: A Barbershop Owner's Check”, 64 characters decoded). Every meta description is within 160 characters.
- No rendered marketing page links to `/#pricing`, `#home` or `#paths`.

Screenshots of the widgets are in `docs/seo/batch-3-screenshots/` (about 7 MB) and are not in git.

`astro preview` cannot run: `@astrojs/vercel` does not support the preview command. Lighthouse and the viewport checks used `npm run dev` at `http://127.0.0.1:4321`. See `docs/seo/batch-3-lighthouse-before.md` and `docs/seo/batch-3-lighthouse-after.md`.

## Task 1 — demo stills

- New `scripts/capture-landing-demo-stills.mjs` writes AVIF and WebP stills, including 2×, to `public/images/landing-demo/stills/`. 1× WebP sizes are all under 80 KB.
- `landingDemoPreview.astro` and the reports row render `<picture>` stills with width, height, lazy loading and the caption “Example shop – fictional data”.
- `Feature261MoreIncluded` is a static pill list (booking history, roster, services, Stripe payouts, hosting). It is now an Astro component with no client directive. The pills do not repeat the rate-card headings, so both lists stay.
- Homepage no longer loads demo products or barbers, and no longer runs `initProductRails`. The stagger script stays because `.feature261` is still on the page.
- React widgets used by `/demo` were left in place.
- Rendered HTML of `/` and `/booksy-alternative` does not contain the demo service names, Cutstate, product names or the reports figures.

## Task 2 — homepage hero

- Eyebrow, three-line H1, lead, “See it working”, meta row, honesty line and Starter text link use the Batch 3 copy and the price constants.
- At 375×812 and 1440×900, with the cookie banner dismissed, the H1, lead, primary CTA and meta row sit inside the first viewport. The honesty line also fits on mobile, so it stays under the CTA.

## Task 3 — homepage order

- Order is hero, difference, demo stills, rate card, worked example, post-purchase steps, switcher, FAQ, contact, final CTA, footer.
- Removed `SystemChooser`, `LandingValueCards`, the homepage `Pricing36` block, and their unused CSS and `initSystemChooser`. `pricing36.tsx` stays because the launch wizard uses it.
- Difference H2 is “Barbershop software that sends clients to your shop, not a marketplace”. The online-booking guide link sits in the bookings pillar. `/compare` and the cost calculator sit in that section as well as in the switcher, so `/compare` appears more than once in body copy.
- Switcher illustrations are gone. The current-system and move-when-ready copy remains in two columns.
- Final CTA adds the Starter text link with `starter_plan_explore_click` and `homepage_final`.
- Homepage scroll height at 375px: 17118px before, 14764px after. One H1, and it is the first heading in `main`.

## Task 4 — pricing arithmetic

- Landing rate-card heading is “One price per shop. Every barber included.” The price stays in the card. Condition lines, including the approved refund sentence, render on the homepage and on `/pricing`.
- The 5-barber Booksy example is computed with `estimateBooksyMonthlySubscription(5)`. `BOOKSY_FACTS_CHECKED_DATE` is still 2 October 2026.
- The Starter chooser line is homepage-only and links to `/pricing#plan`.

## Task 5 — FAQ

- Homepage FAQ is `HOMEPAGE_FAQ_ITEMS` (10). The first question is “How much does Full KERSIVO cost a shop?” because `/pricing` already asks “How much does KERSIVO cost?”.
- “no account to create” stayed: the booking flow has no account, password or guest step that would make it false.
- The contact answer adds the claims-policy line that one business day is a response target.
- The four moved questions, plus “Does KERSIVO replace my card reader?”, are on `/barbershop-online-booking` with matching FAQPage JSON-LD.
- Knowledge now uses the homepage list plus those moved items.
- FAQPage JSON-LD questions and answers equal the visible homepage FAQ.

## Task 6 — `/pricing`

- Title, hero, quick answer, included groups, `#plan`, chooser lists, fees note, FAQ order, two new billing questions and the final CTA are Full-first.
- The old H2 “Start on Starter” is gone. The final subheadline still says “Start on Starter” as a sentence, not a heading.
- Starter limits stay stated. Last updated is 28 October 2026. The Batch 1 description is unchanged.
- The short “Choose Full / Choose Starter” SMS bullet does not repeat the monthly-allowance clause. The rate card and the SMS FAQ still do.

## Task 7 — `/barbershop-websites`

- Title is “Barbershop Website with Online Booking UK | KERSIVO”. The description uses `SAAS_MONTHLY_GBP`.
- Primary CTA is Start Full (`saas_subscribe_click`, `barbershop_websites_hero`). Secondary is “See a demo website”.
- The refund sentence renders beside the price. `/barbershop-website-design` was not changed.

## Task 8 — JSON-LD

- SoftwareApplication is Full-first, with the six features, `applicationSubCategory`, `operatingSystem` “Web browser”, and prices from `SAAS_MONTHLY_GBP.toFixed(2)`.
- WebPage `name` and `description` match `DEFAULT_TITLE` and `HOMEPAGE_DESCRIPTION`. `primaryImageOfPage` is the default OG image. `dateModified` is `2026-10-28`.
- Organization has `alternateName` “Kersivo” and a customer-support `contactPoint`. No legal name, founder, address, phone or rating.

## Task 9 — description

- `DEFAULT_DESCRIPTION` is unchanged because `meta.ts` uses it as the fallback for any page that omits a description.
- The homepage and its WebPage node use `HOMEPAGE_DESCRIPTION`.

## Verification

- `npm run claims:check` passed.
- `npm run typecheck` passed.
- `npm test`: 3 failed, 5047 passed. Two failures were the still-swap assertions in `blacklineDemoCtas.test.ts` and `storefrontThemeIsolation.test.ts`; both were updated and then passed. The third was the known `financialEndpoints` MANAGER 403 timeout in the full run. Alone, that file passed (37 tests in that rerun, including the MANAGER case).
- Screenshots: `docs/seo/batch-3-screenshots/` at 375×812 and 1440×900 for `/` (top and full), `/pricing` (top and `#plan`) and `/barbershop-websites` (top).
