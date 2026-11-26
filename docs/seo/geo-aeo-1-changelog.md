# GEO/AEO stage 1 — answer-first Insights (changelog)

Branch `seo/geo-aeo-1-answer-first`. Plan: `docs/seo/GEO-AEO-PLAN.md`, stage 1.

## What changed

| File | Change |
|---|---|
| `src/lib/insights/insightsShortAnswers.ts` | New. One question + a 40–80 word answer for each of the 20 published Insights articles, and `findInsightsShortAnswerSlot()` (after the H1, hero figure and any all-italic disclaimer, before the first body paragraph). |
| `src/components/insights/InsightsShortAnswer.astro` | New. "Short answer" block: kicker, the question as an H2, the answer. |
| `src/layouts/InsightsArticleLayout.astro` | Renders the block in every published article and passes the answer to Article JSON-LD. |
| `src/lib/seo/insights.ts` | `buildInsightsArticleJsonLd` accepts `abstract`. |
| `src/pages/llms.txt.ts` | Insights links carry the question and answer instead of the meta description. |
| `src/styles/components/insights-preview.css` | `.insights-short-answer` styles (paper card, red top rule, same tokens as the owner note). |
| `src/lib/insights/insightsShortAnswers.test.ts` | New. Every published article has an answer and nothing else does; 40–80 words; no "KERSIVO" in the answer; every figure in an answer already appears in the article Markdown; slot placement; layout, JSON-LD and llms.txt wiring. |

## Why

AI answers and AI Overviews quote short, self-contained passages near the top of a page. Search Console shows chat-style questions (for example "how should a barbershop handle walk-ins during peak hours?") reaching our articles at positions 3–6 with no clicks, while the articles open with narrative and answer half-way down. Each article now opens with the plain question and a quotable answer.

## Rules followed

- Answers only restate the article. The test checks that every number (£, %, pence, dates) in an answer is in the article text.
- Answers are neutral: no product mention, no CTA. Commercial links per article are unchanged (Batch 5 budget).
- Article dates are not bumped: the substance of the articles did not change.

## To review (founder)

- Read the 20 answers in `src/lib/insights/insightsShortAnswers.ts`. They are new public copy derived from the approved Notion articles; if Notion is the source of truth for article copy, they may need to be mirrored there.

## After merge (founder)

Request reindexing in Google Search Console and Bing Webmaster Tools (URL Inspection → Request indexing) for the seven articles with the most impressions:

1. `/insights/how-much-do-barbershop-owners-make-uk`
2. `/insights/barbershop-walk-ins-vs-appointments`
3. `/insights/apprentice-barber-funding-costs-2026`
4. `/insights/barber-dermatitis-skin-care-hse`
5. `/insights/barbershop-business-rates-2026-england`
6. `/insights/barber-commission-pay-minimum-wage-uk`
7. `/insights/barbershop-no-show-cost-when-deposit-makes-sense`

Measure after 4–6 weeks: clicks and CTR for chat-style queries on these pages in GSC, and `/insights/*` citations in the monthly 10-prompt AI check.

## Screenshots

Before (production) and after (local dev) at 375 and 1440 px, walk-ins and no-show articles: `/tmp/kersivo-shots/geo-aeo-1/` (`before-*.png`, `after-*.png`). No horizontal scroll at either width.
