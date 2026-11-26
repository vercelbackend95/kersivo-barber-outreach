# Audit P1 — fee claims in titles, sitemap lastmod, IndexNow

Branch `seo/audit-p1-claims-lastmod`. Source: the 20-day audit of 26 November 2026 (P1-1, P1-2, P1-3).

## P1-1: no zero-fees claims in titles, Stripe qualifier in descriptions

Six titles promised "0% Fees", which is not true for online payments (Stripe fees apply), and several descriptions named "0% KERSIVO commission" without the Stripe qualifier the claims policy requires.

| Page | Before | After |
|---|---|---|
| `/vagaro-alternative` | title with "0% Fees" | `Vagaro Alternative UK for Barbers: Flat £39/month \| KERSIVO`; description ends "0% KERSIVO commission (Stripe fees apply)." |
| `/nearcut-alternative` | title with "0% Fees" | `Nearcut Alternative UK: Own Site + Booking, Flat £39/mo`; same description ending |
| `/phorest-alternative` | title with "0% Fees" | `Phorest Alternative UK for Barbershops: Flat £39/mo` |
| `/squire-alternative` | title with "0% Fees" | `SQUIRE Alternative UK for Barbershops: Flat £39/mo` |
| `/barbershop-online-booking` | `… £39/mo, 0% Fees` | `Barbershop Online Booking UK: £39/mo, 0% KERSIVO Commission` |
| `/barbershop-retail-pickup` | `… £39/mo, 0% Fees` | `Barbershop Click and Collect: £39/mo, 0% KERSIVO Commission` |
| `/barbershop-websites/{city}` | description ended "0% KERSIVO commission." | ends "0% KERSIVO commission (Stripe fees apply)." (London 153, Birmingham 157, Bournemouth 158 characters) |

The online booking and retail pickup titles keep their price hook and name KERSIVO's commission instead of the audit's alternative wording: the hook was the reason for those titles, and "0% KERSIVO Commission" is the approved claim.

Guard: `scripts/claims-guard.mjs` now bans `\b0% fees\b` (case-insensitive, so "0% Fees" in a title fails the build; "10% fees" does not match). Tests: `claimsGuard.test.ts` (a title fixture fails the guard), `cityPages.test.ts` (every city description, including long names such as "Newcastle upon Tyne", ends with the Stripe qualifier).

## P1-2: sitemap lastmod follows content changes, IndexNow does not miss late merges

### Why

Twelve pages changed in November without their sitemap `<lastmod>` moving, because lastmod was the visible "Last updated" date and that date (rightly) stays put when facts and prices did not change. IndexNow submits only URLs whose lastmod is recent, so Bing never heard about those changes. The IndexNow window was also one day: a PR merged a day after its lastmod date was never submitted.

### What changed

| File | Change |
|---|---|
| `src/lib/seo/pageDates.ts` | New `CONTENT_CHANGED_ISO`: per-page date of a content change that kept the visible date. `getStaticPageLastModified()` returns the later of the two dates, so the sitemap and IndexNow see the change while the visible date and the WebPage `dateModified` that mirrors it stay as they were (the same rule as Insights in GEO/AEO stage 1). Entries: `/starter`, `/compare`, `/barber-booking-fees-uk` (26 Nov: FAQ, deposits table, press card and CSV); `/vagaro-alternative`, `/nearcut-alternative`, `/phorest-alternative`, `/squire-alternative`, `/barbershop-online-booking`, `/barbershop-retail-pickup` (26 Nov: the new titles above); `/square-appointments-alternative`, `/setora-alternative` (14 Nov: "In short" answer). `BARBERSHOP_WEBSITES_LAST_MODIFIED_ISO` → 24 Nov (city guide cards). |
| `src/lib/seo/defaults.ts` | `HOMEPAGE_LAST_UPDATED_ISO` → 26 Nov (FAQ questions added). No visible date, so the constant moves and JSON-LD and sitemap stay equal. |
| `src/lib/seo/pricingPage.ts` | `PRICING_PAGE_CONTENT_MODIFIED_ISO` → 26 Nov (migration FAQ). The "terms as of" date (28 Oct) is unchanged because prices and terms did not change. |
| `src/lib/seo/indexNow.ts` | `INDEXNOW_LOOKBACK_DAYS` 1 → 3: today and the three days before, so a changed URL is submitted at most four times and a merge up to three days after the lastmod date is still submitted. |
| Tests | `marketingSitemap.test.ts` (new lastmod values; new test: every `CONTENT_CHANGED_ISO` key is a sitemap path with a valid date later than its visible date), `indexNow.test.ts` (3-day window, late-merge case), and the page tests that asserted lastmod = visible date (`/compare`, vagaro, squire, setora, online booking, retail pickup) now assert lastmod ≥ visible date. |

### Differences from the audit's proposal

- The audit suggested that WebPage `dateModified` also use the later date. It does on the homepage and `/pricing` (no visible date there), but on pages with a visible "Last updated" date `dateModified` keeps mirroring that date, so the page and its structured data never disagree.
- `/free-preview` is not in `CONTENT_CHANGED_ISO`: its only change was the demo shop name in an example caption.
- Insights (audit section 3c, step 3, approved by the founder on 26 Nov): see below.

### Insights: the "Short answer" block moves article lastmod

All 20 published articles got the "Short answer" block under the H1 on 26 Nov 2026 (GEO/AEO stage 1, PR #315). It changes the first screen of every article, so search engines should recrawl them, but the articles' substance did not change, so their visible "Updated" line and Article `dateModified` stay as they were.

| File | Change |
|---|---|
| `src/lib/seo/insights.ts` | `INSIGHTS_ARTICLE_TEMPLATE_REVISED_ISO = '2026-11-26'` and `getInsightsArticleSitemapLastmod()`: an article's sitemap lastmod is the later of its own date and the template date. The hub and category archives keep the newest article's own date, because their article cards did not change. An article published after 26 Nov keeps its own date. |
| `src/lib/seo/insightsPublication.test.ts` | New test: every article's sitemap lastmod is the later of the two dates, its Article `dateModified` is its own date, and the hub and archives are unchanged. |
| `src/lib/seo/marketingSitemap.test.ts` | Article lastmod expectations now 26 Nov. |

Move the constant only for a change that alters what every article page says (not for styling).

### How to keep it right

When a PR adds an FAQ, a section or an answer block, or changes a title or description, without changing facts or prices: add a line to `CONTENT_CHANGED_ISO` dated the day it ships. When facts or prices change, move the page's own "Last updated" constant instead. The `marketingSitemap` test fails on a stale entry (a content date not later than the visible date).

## P1-3: reindexing (founder actions)

IndexNow picks up the changes on its own: the first 06:40 UTC run after the merge submits every URL with lastmod in the last three days (all the 26 Nov pages above and all 20 Insights articles if the merge happens by 29 November; the 24–25 Nov pages only if it happens by 27–28 November). Google needs Search Console, and Bing should get the rest by hand.

1. Search Console and Bing Webmaster Tools: resubmit `https://kersivo.co.uk/sitemap.xml`.
2. Search Console → URL Inspection → Request indexing, spread over 2–3 days (daily limit), in this order:
   - New URLs, if URL Inspection says they are not indexed yet: `/barbershop-websites/london`, `/barbershop-websites/birmingham`, `/barbershop-websites/bournemouth`, `/kersivo-vs-booksy`, `/barbershop-reports`, `/barbershop-retail-pickup`, `/free-tools`, `/barber-price-calculator`, `/insights/editorial-standards`, `/barbershop-price-list-template`.
   - Rebuilt or retitled: `/`, `/compare`, `/pricing`, `/starter`, `/vagaro-alternative`, `/nearcut-alternative`, `/phorest-alternative`, `/squire-alternative`, `/barbershop-online-booking`, `/barbershop-website-design`, `/barbershop-websites`, `/barber-booking-fees-uk`, `/about`.
   - Rebuilt on 14 Nov (skip any whose "Last crawl" in URL Inspection is after 14 Nov): `/booksy-alternative`, `/fresha-alternative`, `/treatwell-alternative`, `/timely-alternative`, `/barber-software-cost-calculator`.
   - Insights with the new "Short answer" block: `how-much-do-barbershop-owners-make-uk`, `barbershop-walk-ins-vs-appointments`, `apprentice-barber-funding-costs-2026`, `barber-dermatitis-skin-care-hse`, `barbershop-business-rates-2026-england`, `barber-commission-pay-minimum-wage-uk`, `barbershop-no-show-cost-when-deposit-makes-sense`.
3. Bing Webmaster Tools → URL Submission: the 14 Nov rebuilds above (IndexNow will not submit them, their lastmod is older than three days), and anything IndexNow missed if the merge happens after 29 November.

## Checks

`npm run claims:check` pass, `npm run typecheck` 0 errors, `npm test` and `npm run build` (see the PR). No markup changed (titles, descriptions and sitemap dates only), so no screenshots; the new titles and lastmod values are checked on the Vercel preview.
