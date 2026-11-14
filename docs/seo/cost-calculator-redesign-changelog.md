# /barber-software-cost-calculator redesign (14 November 2026)

**Problem:** 101 impressions, 2 clicks, average position 9.0. The page ranked but the snippet and first screen did not answer the searcher's question, and the answer (results) sat a long scroll below the inputs.

## What changed

- **Search snippet.** Title `Barber Booking Software Cost UK: Free Calculator | KERSIVO`; description leads with the question "How much does barber booking software cost?" and names the three fee types. URL, canonical and JSON-LD types unchanged.
- **Hero.** H1 is the searcher's question. One hard fact (Full KERSIVO £39/month per location, every barber, website and domain included; 0% KERSIVO commission with the Stripe fee note). A worked-example "bill" for a five-chair shop, rendered from the engine, animates in once on load.
- **Workbench.** Inputs on the left, a sticky live verdict on the right: the Full KERSIVO figure (counts to new values), calculated differences against each fully priced platform, an honest line naming any platform that costs less on software alone, ranked bars that re-order (FLIP), and the providers that need a quote. Phones/tablets get a slim result dock while editing. The ten per-platform breakdown cards are kept, behind "Every platform, line by line".
- **Fixed fee vs per barber vs commission** (new section). Three model cards with verified examples, plus an interactive team-size chart (1–10 barbers, engine data) with a slider and keyboard support. Lines draw once when first on screen.
- **Worked examples** now show bar charts and a "Load this shop into the calculator" link (same URL contract as shared links; applied without reload when JS runs).
- **What £39 a month gets your shop** (new section): five outcomes addressed to the owner, plus an explicit "What KERSIVO doesn't do" card (no marketplace).
- Methodology moved up, right after the examples, so the assumptions sit next to the numbers. Provider deep-dives, VAT, payments, sources, FAQ and the final CTA are unchanged.

## Guardrails kept

- Every figure comes from the engine or the `*Facts.ts` modules; no hand-written £ or % in components or copy modules (tested).
- No "cheapest", "winner" or "savings" language; differences are stated as calculated "£X less than <platform>", and lower-priced platforms are named.
- `prefers-reduced-motion`: all motion off, nothing hidden. No hydrated islands; two small module scripts (calculator shell, team chart).

## Tests

New `src/lib/costCalculator/costVerdict.test.ts`. Updated copy/structure assertions in `barberCostCalculatorPage.test.ts`, `calculatorUi.test.ts`, `comparisonCtas.test.ts` and `marketingSitemap.test.ts`.
