# Decision amendment — six Insights categories (17 October 2026)

**Status:** Owner-approved amendment to KERSIVO Insights Master Bible v1.0  
**Supersedes:** Master Bible §6 progressive five-category maximum and the “no empty category landing pages” launch rule, **only** as clarified below.  
**Does not rewrite:** Master Bible v1.0 historical text. Keep that file intact as the original decision record.

## What changed

The owner now approves:

1. Exactly **six** permanent editorial categories (typed IDs, fixed display order).
2. A stable taxonomy registry as the single source of truth for category labels, paths and SEO copy.
3. **Clickable** hub topic modules that open real category archive routes for all six IDs.
4. Honest **empty-state** archives that remain publicly navigable with `noindex,follow` until a separate category indexability gate is owner-approved.
5. Exactly **one** primary `categoryId` per published article.

## Why

Five non-interactive topic labels could not scale into a coherent archive model. Six named categories match how UK barbershop owners think about the business (profit, clients, brand, operations, tools/payments, industry/people) and keep future articles out of overloaded catch-all buckets.

## SEO stance (explicit)

Category routes may exist with zero or few articles. That does **not** make them indexable. Indexability requires:

- Real owner-approved published articles in that category,
- A substantial distinct introduction,
- A worthwhile collection, and
- `indexable: true` on the category registry entry.

At the four-article launch state, all six category routes ship as navigable **noindex** archives and are excluded from the marketing sitemap.

## Implementation anchor

- Registry: `src/lib/insights/categories.ts`
- Archives: `src/pages/insights/category/[category].astro`
- Hub strip: `src/components/insights/InsightsTopicStrip.astro` + `getInsightsTopicStripItems()`

Article URLs, Notion source integrity and the publication registry remain unchanged.
