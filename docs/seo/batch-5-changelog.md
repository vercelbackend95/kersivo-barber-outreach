# Batch 5 changelog — cluster & content linking

Branch: `claude/seo-batch-5-cluster-linking-901837`, from `origin/main` at `3ef996f2`. Roadmap items P2-02, P2-03, P2-10, P2-11, P2-12. The homepage, `/pricing`, the comparison pages, legal pages, `/seo-growth`, Prisma/booking/payment code, `vercel.json` and analytics were not touched. No Insights source text (Notion export) was edited.

## Task 1 — `/starter` (P2-02)

Files: `src/lib/seo/starterPage.ts`, `src/pages/starter/index.astro`, `src/styles/components/starter-landing.css`.

- Title: “KERSIVO Starter | £0/Month for UK Barbershops” → “Free Barber Booking System UK – £0/Month | KERSIVO Starter” (58 characters, the roadmap wording as given).
- Description (159 → 155): “KERSIVO Starter for UK barbershops: £0/month, 0% KERSIVO commission, hosted online booking, up to 4 barbers, £5 deposits or full payment, reminders and QR Kit.” → “Free barber booking for UK shops: £0/month, 0% KERSIVO commission. Clients pay a £5 deposit or in full via your Stripe; Stripe fees apply. Up to 4 barbers.”
- The paragraph directly under the H1 (“A free booking system for UK barbershops — £0/month.”) is now the qualifier: “Free means £0/month and 0% KERSIVO commission. Every public booking is secured by a £5 deposit or paid in full through your own connected Stripe account; standard Stripe processing fees apply.” The old lead (“A serious booking system…”) moved into the fine print: “Set up your diary, team, services and clients first. A connected Stripe account is required before public bookings go live. KERSIVO adds 0% platform fee.”
- “Free” appears only in the title, the description and the H1, each with the £5 / Stripe qualifier in the same element or right after it.
- New box “When Full is the better fit” under the Starter/Full cards. It has four conditions: more than 4 bookable barbers; own branded website and domain; Pay at shop or choose the payment options; full booking history, Reports, Retail and SMS reminders within a monthly allowance. Then “Full also has 0% KERSIVO commission. Standard Stripe payment-processing fees still apply.” and the text link “See Full KERSIVO pricing →” → `/pricing#plan` (`plan_my_setup_click`, `starter_full_fit`). Starter stays the primary CTA. There is no `/admin/launch` on this page.
- Last updated 6 → 28 October 2026 (also the sitemap `lastmod`).

## Task 2 — `/barbershop-online-booking` (P2-03)

Files: `OnlineBookingHero.astro`, `OnlineBookingJourney.astro`, `OnlineBookingPayments.astro`, `OnlineBookingPlanChoice.astro`, `src/lib/seo/barbershopOnlineBookingPage.ts`, `src/lib/barbershopOnlineBooking/planChoiceContent.ts`, CSS for journey and plan choice.

- Breadcrumb (HTML and JSON-LD): Home › Barbershop websites › Online booking → **Home › Online booking**. `/barbershop-website-design` keeps its breadcrumb under websites.
- Hero terms: “KERSIVO Starter £0/month · Full £39/month per location” → “Full KERSIVO £39/month per location · KERSIVO Starter £0/month” (Full first). The Stripe line under them is unchanged.
- Walkthrough step 04 now shows both payment flows:
  - Copy: “…On a live KERSIVO Starter booking page, clients then choose to pay a £5 deposit or the full price.” → “…The payment step depends on the plan: on KERSIVO Starter, clients choose a £5 deposit or the full price; on Full KERSIVO, the shop decides whether clients pay at the shop, pay a £5 deposit or pay in full.”
  - Preview: the Starter panel (“Payment · the client chooses”: Pay £5 deposit / Pay in full) plus a new Full panel (“Payment · the shop sets one rule”: Pay at shop / £5 deposit / Pay in full). Amounts come from the demo service price. This matches `bookingPaymentPolicy`: Full owners set one mode (NONE / DEPOSIT / FULL).
- Payments section: lead now covers both plans. The CTA “Explore KERSIVO Starter” → `/starter` becomes “See Full KERSIVO pricing” → `/pricing#plan`.
- Section 07 plan chooser: the shared Starter/Full price cards (Starter first) are replaced by an intent chooser.
  - **Choose Full if you want…** (own branded website and domain; more than 4 bookable barbers; Pay at shop or set the payment rule yourself; full booking history, Reports, Retail and SMS reminders within a monthly allowance). Buttons: “Start Full KERSIVO — £39/month” → `/admin/launch` (`saas_subscribe_click`) and the link “See what Full includes →” → `/pricing#plan`.
  - **Starter fits if…** (hosted booking page is enough; up to 4 bookable barbers; every online booking can take a £5 deposit or full payment through your own Stripe). Text link only: “Start on Starter (£0/month) →” → `/starter` (`starter_plan_explore_click`).
  - All three links use placement `barbershop_online_booking_chooser`.
  - Lead and close lines rewritten to match. Disclosure and the five plan FAQs are unchanged.
- `StarterFullPlanCards` is now used only by `/starter`.

## Task 3 — `/barbershop-website-design` (P2-10)

Files: `WebsiteDesignProcess.astro`, `barbershop-website-design-process.css`, `src/lib/seo/barbershopWebsiteDesignPage.ts`.

- Removed the Full KERSIVO price card from Section 06: £39 per location, included facts, billing note, and the link “See what’s included in Full KERSIVO”. The section is now the timeline, with the “managed subscription” note beside it on desktop and below it on mobile.
- One closing sales block remains (`WebsiteDesignFaqClose`, “See What Your KERSIVO Website Includes.” → `/barbershop-websites`). Every commercial anchor on the page points to `/barbershop-websites`: hero secondary, closing primary and breadcrumb. The other links go to the demo or the Terms.
- Description (157 → 152): “…through a fictional CUTSTATE demo, with practical advice on…” → “…through a fictional CUTSTATE demo: practical advice on…”.

## Task 4 — Insights linking (P2-11)

Files: `scripts/insights/link-overlays.mjs`, 3 regenerated `editorial-staging/insights/*-display.md`, `src/lib/insights/insightsLinking.ts`, `src/lib/insights/categories.ts`, `src/pages/insights/category/[category].astro`, `insights-category.css`.

How articles are edited: body links go only through the approved overlay list (`INSIGHTS_LINK_OVERLAYS`). It wraps a phrase that already exists verbatim in the Notion source. The `*-display.md` files are then regenerated with `compose-article.mjs`. `node scripts/insights/check-all.mjs` passes (20/20).

A commercial link is a link to `/pricing`, `/starter`, `/barbershop-websites`, `/barbershop-online-booking`, `/barbershop-website-design`, the calculator, `/compare`, `/demo`, `/admin*` or `*-alternative`. Citations in the numbered References list are not counted. The limit is ≤ 3 per article (body + related tools/guides + end box), enforced by `insightsLinking.test.ts`.

New body links (overlays):

| Article | Phrase | → |
|---|---|---|
| Walk-ins vs appointments | “like being able to book without phoning” | `/barbershop-online-booking` |
| Google booking link | “paste the address of your booking page” | `/barbershop-online-booking` |
| Second visit | “A booking system that keeps client history” | `/barbershop-online-booking` |

End boxes (buyer-adjacent articles only):

| Article | Before | After |
|---|---|---|
| No-show deposits | `/starter` “See KERSIVO Starter booking and payment options” | `/barbershop-online-booking` “See how deposits and payment options work in KERSIVO online booking” (Starter rule, Full choice, Stripe fees) |
| Walk-ins | — | `/barbershop-websites` “Show clients how to book, and how walk-ins work, on your own website” |
| Google booking link | — | `/barbershop-websites` “Point your Google booking link at your own branded website” |
| Do barbers need a website | — | `/barbershop-websites` “See what a KERSIVO barbershop website includes” |
| Second visit | `/barbershop-online-booking` | `/pricing#plan` “See what Full KERSIVO includes for client history” |
| Local clients | `/barbershop-online-booking` | `/barbershop-websites` “See what a KERSIVO barbershop website includes” (0% commission + Stripe fees) |
| Card fees | `/barber-software-cost-calculator` | `/barbershop-online-booking` “See how online deposits and payments work in KERSIVO” (0% commission + Stripe fees) |
| Gift vouchers | `/pricing` “See current KERSIVO plans” | removed (off-buyer) |
| December hours, haircut pricing, Google reviews | unchanged | unchanged (reviews note reworded) |

Related-reading product links removed:

- **Off-buyer articles:** MTD, unfair dismissal, apprentice, business rates and gift vouchers lost their forced product links. Commission pay and dermatitis had none.
- **Duplicates over the limit:** no-show, walk-ins, Google booking link, website need, second visit, Google reviews, local clients and card fees.

Rendered result per article (body excluding references + related + end box): no-show 3, website need 3, local clients 3; walk-ins, Google booking link, Google reviews, second visit, card fees, December hours, haircut pricing and owner earnings 2; loyalty and busy diary 1; MTD, unfair dismissal, apprentice, business rates, commission pay, dermatitis and gift vouchers 0.

Category intros (new line under the intro):

| Category | Link |
|---|---|
| Business & Profit | “barber software cost calculator” |
| Clients & Growth | “barbershop websites with online booking” → `/barbershop-websites` |
| Brand & Marketing | “barbershop website design” → `/barbershop-website-design` |
| Bookings & Operations | “barbershop online booking” → `/barbershop-online-booking` |
| Tools & Payments | “Full KERSIVO pricing” → `/pricing#plan` |
| Industry & People | none |

## Task 5 — JSON-LD check (P2-12)

- Article `/insights/barbershop-walk-ins-vs-appointments` (and all 20 articles): `Article.author` = Organization “KERSIVO”, no `Person` anywhere in the JSON-LD. BreadcrumbList is KERSIVO › Insights › {category} › {headline}.
- Inner page `/barbershop-online-booking`: `WebPage.breadcrumb` is BreadcrumbList Home › Online booking. `/barbershop-website-design`: Home › Barbershop websites › Website design.
- No code change was needed for the Article schema.

## Sitewide titles and descriptions

All 50 sitemap URLs are now ≤ 60 / ≤ 155 and unique. Batch 4 left these over the limit; their Insights registry metadata (not the article text) was fixed:

- `making-tax-digital-barbers` description 157 → 142
- `barbershop-loyalty-scheme-uk` 157 → 148
- `do-barbers-need-a-website-uk` 156 → 148
- `barber-commission-pay-minimum-wage-uk` 159 → 150
- `google-business-profile-booking-link-barbershop` title (64) “…: A Barbershop Owner's Check” → “Google Business Profile Booking Link: A Barbershop Check” (56)

## Tests

- New or rewritten: Starter qualifier and fit box, intent chooser, both payment flows in the journey, Full pricing CTA in payments, breadcrumb (page + cluster test), website-design process without a price card, Insights commercial-link budget (limit, buyer-adjacent boxes, no links in off-buyer articles, Stripe next to 0%), category product links, sitemap `lastmod` for `/starter`.

## Verification

- `npm run claims:check`: pass.
- `npm run typecheck`: 0 errors.
- `npm test`: 5064 passed, 2 failed in the full run. The `financialEndpoints` MANAGER 403 timeout is known and passed when rerun alone. The other failure was the `/starter` sitemap `lastmod` (intended date change), and the test is updated. The affected suites were rerun and pass.
- `node scripts/insights/check-all.mjs`: PASS 20/20.
- `npm run build`: passed locally, including `prisma generate`, `claims-guard` and `insights/check-all`.
- Server HTML (dev server): exactly one `<h1>` on `/starter`, `/barbershop-online-booking`, `/barbershop-website-design` and all 20 articles. FAQPage JSON-LD equals the visible FAQ (Starter 10/10, online booking 5/5). Commercial link counts per article are as listed above.
- Screenshots at 375 and 1440 of `/starter` (top, fit box, final CTA), `/barbershop-online-booking` (top, step 04, payments, chooser) and the design page are in `docs/seo/batch-5-screenshots/`, not in git. Horizontal overflow is 0px on all. Fixed during review: arrows touching link text in the chooser and fit box; an empty right column on the design page at 1440 after the card was removed.

## Not verified

- Vercel preview: see the PR.
- GA4: the new placements (`starter_full_fit`, `barbershop_online_booking_chooser`) were not checked in DebugView.

## Facts and decisions needed from the founder

1. **“free” in an article source.** `do-barbers-need-a-website-uk` says “KERSIVO offers a free hosted booking page on its Starter plan” without the £5 deposit / Stripe qualifier. That sentence is Notion source text, so it was not changed. Please edit it in Notion if you want the qualifier there too.
2. **No-show article** has two links to `/starter` and `/pricing` in its own text plus the References list. With the end box it is at the limit of 3. The box now points to `/barbershop-online-booking` (both plans) instead of `/starter`.
3. **December hours and haircut pricing** have no natural phrase in the source for a body link. Their product links are a related-reading guide or tool plus the end box.
4. **Classification.** Owner earnings, busy diary and loyalty are “neutral”: they keep one existing tool or guide link and no end box. Gift vouchers is treated as off-buyer, so its `/pricing` box was removed. Please say if you see any of these differently.
5. The `/starter` H1 still says “A free booking system…”. The roadmap asked only for the qualifier next to it, so the H1 was not changed.
