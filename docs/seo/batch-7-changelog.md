# Batch 7 changelog — optional refinements

Branch: `claude/seo-batch-7-optional`, from `main` at `ffe52f23` (after #136), merged with `main` at `d8ff3f97` (#137, #139). Roadmap section “Batch 7 — Optional”. No pricing, legal text or competitor figure changed. The setup-time change (“a few days”) is a separate PR (#137).

## Done

1. **`/llms.txt`** (`src/pages/llms.txt.ts`), in the llmstxt.org format: `# KERSIVO`, a summary quote and link sections Product, Comparisons, Insights (every published article, generated from the registry) and Optional (Terms, Privacy).
   - Every claim comes from `claimsPolicy.ts` and `defaults.ts`: £39/month per location, Starter £0/month with the £5 deposit / full payment through the shop’s Stripe, “0% KERSIVO commission. Standard Stripe payment-processing fees still apply.”, no setup fee, no VAT added.
   - No setup-time figure. `/seo-growth` is not listed.
   - Served as `text/plain`, cached for 1 hour. Tests check that every linked route exists.
2. **Square 512px logo in schema.** The Organization `logo` now uses `/images/brand/kersivo-mark.png` (512×512, transparent K mark) instead of the 796×555 wordmark `logo_nobg.png`.
   - Insights articles pick it up automatically: since #139 the Article `publisher` is a reference to the same Organization node.
   - The mark is written by `scripts/generate-favicons.mjs` on every build. It is already served on production (200, 512×512).
3. **Homepage FAQPage merged into the main `@graph`.** The homepage now emits one JSON-LD block: Organization, WebSite, WebPage, SoftwareApplication and FAQPage (`#faq`). Before, there were two blocks. FAQ questions and answers are unchanged and still render from `HOMEPAGE_FAQ_ITEMS`.

## Already fixed / dropped

- “Stray space before the full stop after Booksy’s UK pricing page”: production already renders `…pricing page</a>. Card…` with no stray space.
- The over-60 Insights title was fixed in Batch 5.

## Not done — needs the founder

1. **Facebook vanity URL and other profiles in `sameAs`.** `sameAs` is read from the `PUBLIC_SOCIAL_PROFILES` env var, which is not set in Vercel production, so the Organization has no `sameAs` today. Send the final profile URLs (Facebook, Instagram, LinkedIn…). They go into Vercel as a JSON array, with no code change.
2. **One display typeface for H2s.** This is a visual design decision that touches every page. It needs a chosen font and a design review, not an SEO change.
3. **Nav simplification.** The roadmap allows this only with GA4 click data. Share an Explore report of `data-track` clicks by placement.
4. **New OG image** (without “ZERO COMMISSION”). Needs a design.
5. **Virtual office address** → `LEGAL_OPERATOR_SERVICE_ADDRESS` in `src/lib/legal/businessIdentity.ts`. The footer line appears automatically once it is set.

## Tests

- New `src/lib/seo/llmsTxt.test.ts`: format, claims with the Stripe qualifier, no banned phrases or day ranges, every linked route exists, every published article is listed, and the merged homepage graph.
- Updated for the intended change: `brandLogo.test.ts`, `barberDemoJsonLd.test.ts` (logo), `homepageHero.test.ts` (single `jsonLd` block).

## Verification

- `npm run claims:check`: pass. `npm run typecheck`: 0 errors.
- `npm test`: 5071 passed, 1 failed (known `financialEndpoints` MANAGER 403 timeout; passed alone).
- `npm run build`: passed.
