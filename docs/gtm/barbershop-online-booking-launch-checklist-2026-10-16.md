# KERSIVO /barbershop-online-booking — technical SEO release checklist

Prepared during Batch 3. **Pre-release only; this document authorises no deployment, merge, or indexing change.**

## Current state and source
- Route: `/barbershop-online-booking` (`src/pages/barbershop-online-booking/index.astro`).
- SEO source: `src/lib/seo/barbershopOnlineBookingPage.ts`. Canonical is the public `https://kersivo.co.uk/barbershop-online-booking`.
- `BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE = false`; the page passes `noindex={!BARBERSHOP_ONLINE_BOOKING_PAGE_INDEXABLE}` and `robotsFollow` to LandingLayout.
- The route is deliberately absent from `MARKETING_SITEMAP_ENTRIES` and must stay absent until explicit release approval.
- HTML breadcrumbs and WebPage.breadcrumb describe Home → Barbershop websites → Online booking.
- The pillar WebsiteFeaturesPanel links to the booking guide. The booking guide's breadcrumb and footer link to the parent, and its footer links to the design guide.
- Resources navigation config includes a booking guide item whose visibility is gated on indexability of both booking and pillar pages. It is not currently visible.
- Linked route `/barbershop-website-design` is being audited on a **separate branch/PR**. Its Batch 1/2 work is NOT silently merged into this branch.

## Before approval (no publication)
- [ ] Resolve outstanding Full B1 payment-policy conflict against signed-off commercial terms and live product, without inventing entitlements.
- [ ] Check both shared plan cards and current /terms and /pricing after any subsequent commercial changes.
- [ ] Integrate and test the approved `/barbershop-website-design` and `/barbershop-websites` branches; assess overlapping edits to WebsiteFeaturesPanel, marketingNavigation, footer, and regression tests.
- [ ] Verify the three cluster routes exist on the deployment that will actually serve the public site (not merely on separate preview branches).
- [ ] Resolve or formally triage failing repository CI, including demo BookingFlow integration; do not conceal failures by deleting tests.
- [ ] Verify rendered desktop/mobile UI, keyboard interactions, CTA destinations and demo behaviour, ideally with Vercel-authorised browser access.
- [ ] Verify rendered HTML: one H1, one main landmark, footer outside main; canonical, robots meta and breadcrumbs.
- [ ] Check the rendered JSON-LD against the visible breadcrumb and expected stable WebSite/Organization IDs. No fake ratings/FAQ rich-result claims.

## Launch: only after owner approval
- [ ] Approve the final cluster merge/commit and deployment target, ensuring shared files include both design and booking edits.
- [ ] Decide whether to launch pillar and both supporting pages together. Do not publish links to a route that returns 404 or carries unintended noindex.
- [ ] Set each approved route's INDEXABLE flag to true intentionally; keep preview protection/noindex independently.
- [ ] Include only live, approved, indexable pages in `MARKETING_SITEMAP_ENTRIES`. Set `lastmod` only when a reliable editorial significant-modification date exists; never manufacture build-time lastmod.
- [ ] Ensure `robots.txt` doesn't disallow the public route and verify response headers contain no conflicting X-Robots-Tag.
- [ ] Confirm HTTP 200, one canonical pointing to the chosen production URL, no unexpected redirects, and robots `index, follow` (or the project's supported equivalent) on the final public URLs.
- [ ] Confirm parent → booking/design internal links and reciprocal supporting-guide links; ensure global Resources visibility matches approved release flags.
- [ ] Validate sitemap XML and submit relevant live URLs for indexing in Google Search Console after publishing. Requesting indexing does not guarantee rankings or indexing.
- [ ] Check post-launch CTA analytics and actual booking/conversion paths; don't mistake a demo completion for a customer booking.

## Explicit exclusions from Batch 3
No CSS, image resizing, accessibility redesign, payments/product logic, backlinks acquisition, full policy reconciliation, live deploy or production indexing switches.
