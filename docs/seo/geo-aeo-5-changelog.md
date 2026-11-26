# GEO/AEO stage 5 — entity and E-E-A-T without a personal byline

Branch `seo/geo-aeo-5-eeat`. Plan: `docs/seo/GEO-AEO-PLAN.md`, stage 5 (items 1–3; item 4, Wikidata, waits for independent sources).

## What changed

| File | Change |
|---|---|
| `src/pages/insights/editorial-standards.astro`, `src/lib/insights/editorialStandards.ts` | New public page **How KERSIVO Insights is written and checked** (`/insights/editorial-standards`): short answer under the H1, seven question headings (who writes it, sources, worked examples, dates, KERSIVO's own interest, not advice, corrections). Insights reading surface, WebPage + BreadcrumbList JSON-LD, in the sitemap and `/llms.txt`. |
| `src/layouts/InsightsArticleLayout.astro` | "How we check articles ↗" link in the "About this publication" block of every article. Article JSON-LD gets `citation` from the rendered References/Sources list. |
| `src/lib/seo/insights.ts` | Article JSON-LD: `publishingPrinciples` → the new page; optional `citation`. |
| `src/lib/seo/kersivoEntityJsonLd.ts` | `Organization.knowsAbout` (7 topics, no claims) on every Organization node. No `slogan`: there is no approved slogan in `claimsPolicy.ts`. |
| `src/pages/about.astro`, `aboutPage.ts`, `company-pages.css` | One sentence under "Support and contact" linking to Insights and the new page; `/about` last updated → 26 November 2026. |
| `src/components/insights/InsightsMasthead.astro` | Optional `metaLine` so the new page doesn't say "Topic archive". |
| `pageDates.ts`, `marketingSitemap.ts` | New page in the sitemap with its own content date. |
| Tests | New `src/lib/insights/editorialStandards.test.ts`; sitemap and Insights publication tests updated for the new URL. |

`citation` is filled for the 18 articles whose sources are linked; the walk-ins and Making Tax Digital articles cite sources without links, so they get no `citation` (nothing invented).

## Every statement on the page, and what backs it

| Statement | Backed by |
|---|---|
| Published under the KERSIVO name, no personal byline | Article JSON-LD `author` = Organization; brand rules in `CLAUDE.md` |
| Figures come from GOV.UK/HMRC, HSE, ASA/CAP Code, platforms' own UK pages | References lists in `editorial-staging/insights/*-display.md` (minimum wage, business rates, dermatitis, loyalty CAP Code, card fees) |
| References list names and links each source, "usually" with the checked date | 17 of 20 lists carry "checked"/"accessed" dates; 3 don't, hence "usually" |
| Worked examples are labelled and show inputs | e.g. owner-earnings "constructed four-chair example", no-show maths |
| "Updated" date shown on revision, also in structured data | `updatedDate` → visible "Updated …" line and `dateModified` |
| Short, clearly separated note about KERSIVO in buying-related articles | Owner notes and end CTAs (`insightsLinking.ts`, `insightsCta.ts`) |
| Photographs are editorial, people not presented as customers | Image captions in every article |
| Not legal/tax advice | Existing article endings (e.g. owner-earnings "qualified accountant") |
| Corrections by email to hello@kersivo.co.uk | Contact email in `footerSocialLinks.ts`; revision workflow in `docs/insights/KERSIVO_INSIGHTS_MASTER_BIBLE_v1.0.md` §8.4 |

## Open questions for the founder

- The corrections promise ("we check it against the source … correct it and show the new Updated date") is a process commitment. It matches the editorial workflow; change the wording if you want a different promise.

## Screenshots

`C:/tmp/kersivo-shots/geo-aeo-5/`: `after-standards-{375,768,1024,1440}.png` (new page, full), `before-`/`after-article-aside-*.png` (link in every article), `before-`/`after-about-support-*.png` (`/about`). No horizontal scroll at any width.

## After merge (founder)

Request indexing of `/insights/editorial-standards` in GSC and Bing.
