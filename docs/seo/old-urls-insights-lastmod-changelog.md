# Old URLs redirected, Insights listing lastmod, off-site profiles in sameAs

Branch `seo/old-urls-insights-lastmod`. Source: the reindexing check of 26 November 2026 (`docs/seo/reindex-2026-11-26.md`) and Bingbot's requests in Vercel Observability for 1–25 November 2026.

## Old URLs: permanent redirects instead of 404

Bingbot still requested pages from the site that ran on kersivo.co.uk before this one (a web design portfolio, see `/work/sewing-ataga`, which stays 410), and an old booking page. They returned 404, or sent the booking page to the homepage. Each now redirects permanently (308, `vercel.json`) to the page that does the same job today:

| Old URL | Before | After |
|---|---|---|
| `/packages` | 404 | `/pricing` |
| `/contact` | 404 | `/#contact` (the homepage contact form) |
| `/process` | 404 | `/#setup` (the homepage "From free preview to live site" steps) |
| `/work` | 404 | `/barbershop-websites` |
| `/barbershop-booking-system` | `/` | `/barbershop-online-booking` |

Not redirected:
- `/work/sewing-ataga`: an unrelated portfolio project, keeps its 410 so search engines drop it. The `/work` rule matches the bare path only.
- `/sitemap_index.xml`, `/sitemap.txt`, `/sitemaps.xml`, `/sitemap.xml.gz`: crawlers guess these names. A 404 is the right answer, and `robots.txt` names the real sitemap.

Test: `src/lib/seo/legacyRedirects.test.ts` (each rule is permanent and goes to the expected page, every destination is an indexable sitemap page, the `#setup` and `#contact` anchors exist on the homepage, and nothing redirects under `/work/`).

## /insights and three category archives: sitemap lastmod follows their own changes

Audit P3 (PR #325, 26 Nov) gave the Insights hub a visible subtitle and a new lead, and gave three category archives new snippets (`clients-growth` and `tools-payments`: fuller descriptions; `industry-people`: the shared title pattern and a fuller description). Their sitemap lastmod did not move, because hub and archive lastmod is the newest date of the articles they list, and no article changed. So IndexNow did not submit them, and Google saw no change date.

| File | Change |
|---|---|
| `src/lib/seo/insights.ts` | New `INSIGHTS_LISTING_CONTENT_CHANGED_ISO`: per-listing date of a change to the hub's or an archive's own title, description or intro. `buildInsightsSitemapEntries()` takes the later of that date and the newest article date. Entries: `/insights`, `/insights/category/clients-growth`, `/insights/category/tools-payments`, `/insights/category/industry-people` (all 26 Nov). |
| `src/lib/seo/insightsPublication.test.ts` | New test: every key is a listing page in the sitemap, its date wins, and the archives without a listing change keep their article date. |
| `src/lib/seo/marketingSitemap.test.ts` | New lastmod values for the hub and the three archives. |

No visible date changes, and no JSON-LD changes. The rule is the same as `CONTENT_CHANGED_ISO` for static pages (`docs/seo/audit-p1-claims-lastmod-changelog.md`, "How to keep it right"): when a PR changes what the Insights hub or an archive says, add a line here dated the day it ships.

IndexNow submits the four URLs on the first 06:40 UTC run after the merge, if the merge happens by 29 November 2026. The founder has already submitted them by hand in Bing Webmaster Tools on 26 November.

## Off-site profiles in Organization.sameAs

KERSIVO already had Capterra, GetApp and G2 profiles, but `KERSIVO_OFF_SITE_PROFILES` was empty, so `sameAs` named only Instagram, TikTok and Facebook. The founder sent the public URLs on 26 Nov 2026:

- `https://www.capterra.com/p/10290243/KERSIVO/`
- `https://www.getapp.com/all-software/a/kersivo/`
- `https://www.g2.com/sellers/kersivo` (the G2 company profile, which suits Organization better than a product page)

They join the footer socials in `sameAs` on every page that carries the `#organization` node. Test: `barberDemoJsonLd.test.ts` (footer socials first, then the three profiles).

Not verified by Claude: all three sites put automated visitors behind a bot check, so the profile text could not be compared with the site's entity description. Founder check: each profile uses the description and category from `docs/seo/ai-visibility-playbook.md`, section 1.

## Checks

`npm run claims:check`, `npm run typecheck`, `npm test`, `npm run build`: see the PR. No markup changed (redirects and sitemap dates only), so no screenshots; the redirects are checked with `curl` on the Vercel preview.
