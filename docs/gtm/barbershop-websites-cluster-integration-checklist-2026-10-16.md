# KERSIVO Websites Cluster — pillar Batch 2 integration checklist

Prepared 2026-10-16 on `audit/bsw-batch2-seo-20261016`. **No merge, deployment to production, or indexability approval.**

## Three independent workstreams
- Pillar: `/barbershop-websites` — pillar copy & commercial scope Batch 1, WebPage and 2-level breadcrumb, cluster links, footer semantics and release-gated navigation Batch 2.
- Design guide: `/barbershop-website-design` — Draft PR #102 (design Batch 1/2); its own WebPage and 3-level breadcrumb, links back to pillar, additional Design Guide nav item.
- Booking guide: `/barbershop-online-booking` — Draft PRs #103, #104, #105 (booking Batch 1/2/3); its own WebPage and 3-level breadcrumb, links back to pillar, Booking Guide nav item.

## Shared-file conflict matrix — manual reconciliation required
1. `src/components/barbershop-websites/WebsiteFeaturesPanel.astro`: pillar Batch 2 already combines both target destinations. Keep Branding and Your Team linked to Design Guide (`#your-team`), Online Booking linked to Booking Guide; retain services, retail, contact demo links. Avoid either PR's single-guide change overwriting the other.
2. `src/lib/nav/marketingNavigation.ts`: integrate all three separate Resources > Guides entries; each must respect its route's `INDEXABLE` gate, and child guides should require pillar publication as well.
3. `src/pages/barbershop-websites/index.astro`: preserve Batch 2 WebPage JSON-LD, both footer guide links and global Footer50 outside `main`.
4. `src/lib/seo/barbershopWebsitesPage.test.ts`, `src/lib/seo/barbershopWebsitesFaqClose.test.ts`, and separate design/booking page tests: reconcile assertions for the final six feature-link destinations, schema, footer landmarks and FAQ copy; do not delete protective test coverage.
5. Shared Full payment claims in `src/lib/seo/pricingPage.ts`, `src/lib/pricing/rateCard1Copy.ts`, `src/pages/terms.astro` and shared cards remain a **separate B1 commercial policy blocker**. Do not advertise three selectable Full payment modes without approved policy and implementation parity.

## Site-wide release gates
- [ ] Resolve Full B1 commercial offer/product/Terms mismatch with owner approval. Do not override policy by arbitrary copy changes.
- [ ] Integrate the three pages on a single testable branch, without silently merging protected `main`.
- [ ] Resolve or formally triage CI regressions in booking flow, legal, alternatives and other launch-critical modules. Run Astro checks, Vitest and production build against the exact integrated commit.
- [ ] Confirm exactly one `main` per page and Footer50 outside the content `main`. Confirm h1, CTA destinations and tracking semantics.
- [ ] Confirm the actual rendered HTML contains one self-canonical, the correct meta robots, H1 and visible breadcrumb, with matching structured data.
- [ ] Confirm target anchors and child routes really work, including `/barbershop-website-design#your-team`.
- [ ] Do the owner-requested visual/mobile check last; include 1440, 768, 390 and 320px when practical.
- [ ] **Only upon explicit approval**, make production routes indexable and add all three published URLs to `MARKETING_SITEMAP_ENTRIES`. Do not manufacture sitemap `lastmod` values.
- [ ] Confirm public HTTP 200, no accidental X-Robots-Tag noindex, `robots.txt` crawl permission, working reciprocal cluster links and visible Resources navigation. Submit live URLs to GSC only after release.

## Current safe state
- `BARBERSHOP_WEBSITES_PAGE_INDEXABLE = false`.
- `BARBERSHOP_WEBSITE_DESIGN_PAGE_INDEXABLE = false`.
- `BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE = false`.
- All three URLs absent from the marketing sitemap; Resources pillar entry hidden until indexable.
- No production changes authorised by these audit branches.
