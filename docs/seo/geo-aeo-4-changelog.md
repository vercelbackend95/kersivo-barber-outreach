# GEO/AEO stage 4 — snippet eligibility and indexing checks

Branch `seo/geo-aeo-4-snippets`. Plan: `docs/seo/GEO-AEO-PLAN.md`, stage 4.

## Why

Until now indexable pages sent no robots meta at all, so Google applied its default snippet limits. AI Overviews, Bing/Copilot and other answer engines quote passages; an explicit "quote as much as you need" directive removes any doubt, and a test keeps a future change from quietly taking it back.

## What changed

| File | Change |
|---|---|
| `src/lib/seo/meta.ts` | `INDEXABLE_ROBOTS_CONTENT = 'max-snippet:-1, max-image-preview:large, max-video-preview:-1'`. `resolveRobotsContent` returns it for every page without `noindex`; `noindex` pages keep `noindex, follow` / `noindex, nofollow`. `index, follow` is left out on purpose: they are the defaults, and routes that get `X-Robots-Tag: noindex` from `vercel.json` must not carry a contradicting `index` in the page. |
| `src/components/seo/SeoHead.astro` | Always renders the robots meta (one tag per page). |
| `src/lib/seo/snippetEligibility.test.ts` | New. Open snippet limits on indexable pages; no `nosnippet` anywhere in `src/` or the Insights display Markdown, except `data-nosnippet` on the two demo-widget wrappers (placeholder names and prices must not be quoted as facts); no `X-Robots-Tag` limits snippets; no sitemap URL is caught by a `noindex` header rule; sitemap paths are clean and self-canonical; `robots.txt` lets every AI search crawler and `*` fetch every sitemap URL. |
| `scripts/seo/check-indexable.mjs` | New live check: every `/sitemap.xml` URL returns 200, has exactly one robots meta with open snippet limits and no `noindex`, and one canonical that equals its sitemap URL. `node scripts/seo/check-indexable.mjs [base-url]`. |
| 6 page tests | Expect the new robots content instead of no tag. |

Baseline before this change (production, 26 November 2026): 65/65 sitemap URLs return 200 with a self-canonical; 0/65 had the snippet directive.

## Decision: Google-Extended and GPTBot

Left allowed (not named in `robots.txt`, so they fall under `*`), as recommended in the plan. Blocking them would not change AI Overviews or ChatGPT search, but would limit what the models know about KERSIVO without a live search.

## For the founder (after merge)

1. GSC → Pages report: check that nothing in "Excluded by 'noindex' tag" or "Alternate page with proper canonical" is a page from the sitemap.
2. Bing Webmaster Tools → the same check, then submit `sitemap.xml` again.
3. Request reindexing of the pages changed in stages 1–2: `/`, `/pricing`, `/starter`, `/compare` and the 7 most-viewed Insights articles (list in `geo-aeo-1-changelog.md`).
