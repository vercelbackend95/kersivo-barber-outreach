# GEO/AEO stage 6 — /llms-full.txt

Branch `seo/geo-aeo-6-llms-full`. Plan: `docs/seo/GEO-AEO-PLAN.md`, stage 6, item 2 (item 1, short answers in `/llms.txt`, shipped with stage 1).

## What changed

| File | Change |
|---|---|
| `src/lib/seo/llmsFullTxt.ts` | Builds `/llms-full.txt`: a one-paragraph entity summary, then for 25 pages (8 product, 17 comparison) the URL, last-updated date, the page's direct answer ("In short", quick answer or hero lead) and its full visible FAQ, as `Q:` / `A:` pairs. |
| `src/pages/llms-full.txt.ts` | SSR route, `text/plain`, 1 h cache, same as `/llms.txt`. Reads `FREE_PREVIEW_FLOW_ENABLED` like the pages do, so the homepage, pricing and websites FAQs match what is live. |
| `src/pages/llms.txt.ts` | Link to `/llms-full.txt` under `## Optional` (the llmstxt.org convention for secondary files). |
| `src/lib/seo/llmsFullTxt.test.ts` | Both flag states: H1 and summary with the Stripe qualifier, every page once with URL and date, only sitemap pages, no own copy in the module (every paragraph is an imported constant), every page has a route, served as plain text, linked from `/llms.txt`. |
| `src/lib/seo/llmsTxt.test.ts` | Same change as in PR #319 (accept `.ts` endpoint routes), so the two branches merge cleanly. |

## How it stays true

The file has no copy of its own apart from the title and one introductory sentence. Every answer and FAQ is the same constant that renders on the page and in its FAQPage JSON-LD, and dates come from `pageDates.ts` (the sitemap's `lastmod`). When a page changes, the file changes with it. About 104 KB.

## What is not in it

- Free tools, Insights and city pages: `/llms.txt` already carries each Insights article's short answer, and the tools are calculators rather than text. They can be added later in the same way.
- Body sections that are not answers or FAQs (feature cards, chapters, tables). They live in Astro components, not in reusable constants, and the FAQs already cover the buyer questions from the stage 2 fan-out map.

## Checks

`npm run claims:check` pass, `npm run typecheck` 0 errors, `npm test` 1 failure = the known flaky `financialEndpoints` MANAGER 403 timeout (passes on its own), `astro build` OK (Prisma generate skipped locally: EPERM while another dev server runs; schema unchanged).

No page markup changed, so there are no before/after screenshots for this batch.
