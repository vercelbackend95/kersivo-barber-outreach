# Batch C — /pricing premium plan cards and comparison table

## What changed
- **Shared surface**: `ks-glass-card.css` (from Batch B) gains `--plain`, `.ks-eyebrow` and the key-facts block `.ks-facts`, moved out of `starter-landing.css`. Both `/starter` glance cards, the `/pricing` plan cards and the billing tiles now use it.
- **Key facts**: `KeyFacts.astro` renders the dl. Data lives in `pricingPlans.ts`; `STARTER_KEY_FACTS` is one object used by `/pricing` and the `/starter` hero.
- **Plan cards**: Full is `--accent`, Starter is `--plain` with a grey dot and no pill. Grid is 7/5 from 1024px with `align-items: start`, stacked below it. The Full checklist uses CSS columns, so a tall item leaves no blank pocket beside it.
- **Comparison table**: the Full column is one overlay outline (`.pricing-compare__wrap::after`), so it runs through the group rows and needs no per-row border. Plan name, price and CTA sit on separate lines, and the Starter CTA is an outline button so the header CTAs align.

## Decisions to know about
- **"Stripe fees apply." under the key facts** was not in the brief. The 0% tile needs it nearby under the CLAUDE.md copy rules.
- **Starter description** now reads "A real booking system for one shop. Clients pay via your connected Stripe account." Two lines at 1440, three at 1024.
- **Sticky header** was broken before: `overflow-x: auto` on the wrapper made it stick to the wrapper. The wrapper no longer scrolls (the table is fixed-layout, so nothing overflows). It sticks from 768px at the rendered navbar height (61px, then 69px from 1024px). It stays static on phones, where the header would cover about a quarter of the screen. Group rows are not sticky.
- **Contrast on /starter**: `#77777b` labels (4.3:1) and the `#6c6c70` note are now `#8a8a8e`, to meet AA.
- **Bottom corners of the Full outline** are rounded as well as the top, so the closed outline does not end in square corners.
- **Table checks** were already SVG icons, not text glyphs, so that item needed no change.
- **Removed from the cards**: the `Price` component, and the qualifiers "per location · no setup fee" and "up to 4 barbers · one location". Those facts now sit in the tiles and the description. "one location" still appears in the Starter checklist.

## Screenshots
`docs/seo/batch-c-pricing-screenshots/`
