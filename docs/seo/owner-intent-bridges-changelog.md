# Owner-intent bridges — changelog

Branch `seo/owner-intent-bridges`, from `origin/main` at `17e8d58d`. Goal: turn Insights traffic (mostly barbers) into shop-owner visits that reach commercial pages, without forcing product links into articles that are not about buying. Part B (content plan) is in `docs/seo/content-plan-buying-searches.md`.

No Notion source text, title, meta description, canonical or JSON-LD was changed. `node scripts/insights/check-all.mjs` still passes 20/20.

## What changed per article

| Article | Bridge | Commercial links (counted) |
| --- | --- | --- |
| how-much-do-barbershop-owners-make-uk | New end box → `/compare#cost-by-team-size` "Compare what UK booking platforms cost for a team your size" (£39/month per location, 0% KERSIVO commission, Stripe fees apply). The duplicate "Compare the costs of booking software" related-tool link was removed; the body already links the calculator. | 2 → 2 (+ the chair-rent callout, which is HTML and not counted, as before) |
| barbershop-walk-ins-vs-appointments | Existing `/barbershop-websites` end box gains a second link: "See your own shop’s booking site first: get a free preview" → `/free-preview`. | 2 → 3 |
| apprentice-barber-funding-costs-2026 | "If you own the shop…" note: "Count the chair, not just the wage" → owner-earnings article. | 0 → 0 |
| barber-dermatitis-skin-care-hse | Audience line "For barbershop owners and managers" above the headline. "If you own the shop…" note: "Know what an hour in each chair is worth" → busy-diary (chair-hour) article. | 0 → 0 |
| barbershop-business-rates-2026-england | "If you own the shop…" note: "Rates are one of three lines that move owner profit" (premises £18,000 of the £41,405 gap) → owner-earnings article. | 0 → 0 |
| barber-commission-pay-minimum-wage-uk | Audience line "For shop owners who employ barbers". "If you own the shop…" note: "Commission sets your biggest cost line" (40% vs 50% = £13,500 of the gap) → owner-earnings article. | 0 → 0 |
| barbershop-no-show-cost-when-deposit-makes-sense | No change. It already has three commercial links (Starter, pricing in the body; online-booking end box) and a "Where KERSIVO fits" section, so another link would break the limit. | 3 → 3 |

The off-buyer articles get owner notes that link to owner-focused Insights, not product pages, so Batch 5's "no forced product links" rule still holds. The owner-earnings article is the hub those notes feed, and it carries the commercial step.

## Titles and intros

Titles were left unchanged. Search Console positions per page were not in the export, so there was no way to show a title change keeps the main search. Five of the seven titles or openings already name owners. For the two that don't (commission pay, dermatitis), a short audience line now sits above the H1. The H1 and the article text are unchanged.

## Code

- `src/lib/insights/insightsLinking.ts`: `InsightsOwnerNote` + `getInsightsOwnerNote`, `getInsightsAudience`, optional `secondary` link on end boxes, owner-earnings end box, `/free-preview` now counts as a commercial link.
- `src/components/insights/InsightsOwnerNote.astro` (new), `InsightsCommercialNext.astro` (secondary link).
- `src/layouts/InsightsArticleLayout.astro`: audience line; the owner note is placed at the end of the article text, before the References/Sources list (and the rule above it), by splitting the rendered body.
- `src/styles/components/insights-preview.css`: note, secondary link and audience styles, `:focus-visible`, reduced motion.
- `src/lib/insights/insightsLinking.test.ts`: link budget now counts secondary links and owner-note links; new tests for owner notes (published, non-commercial targets), figures only from the source articles, owner-earnings end box, walk-ins free preview, audience lines.

## Screenshots

`C:/tmp/kersivo-shots/owner-intent-bridges/` — `before-*` and `after-*` at 375 and 1440 for all seven articles (`-top` and `-end`). Horizontal overflow 0px on all.
