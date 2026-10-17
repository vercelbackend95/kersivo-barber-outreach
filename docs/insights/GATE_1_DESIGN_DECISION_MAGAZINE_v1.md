# GATE 1 Design Decision — Magazine Architecture (Founder Approved)

**Status:** LOCKED by founder visual approval (15 October 2026); **updated 16 October 2026** for polish + Owner's Desk  
**Worktree:** `C:/dev/kersivo-insights` · `feat/kersivo-insights-editorial`  
**Reference archive:** [gate1-reference/approved-magazine-direction.jpg](./gate1-reference/approved-magazine-direction.jpg)  
**Master Bible:** [KERSIVO_INSIGHTS_MASTER_BIBLE_v1.0.md](./KERSIVO_INSIGHTS_MASTER_BIBLE_v1.0.md) — **not edited**; supersessions recorded here only.

---

## Approved direction

| Decision | Detail |
|----------|--------|
| Architecture | Full-width magazine editorial under existing global `MarketingNavbar` |
| Masthead | Wide 2-column (~72/28): serif H1 + vertically centred editorial signature |
| Featured | Asymmetric mosaic ~50 / 23 / 27 with **12px dark gutters** between panels |
| Topics | Horizontal strip (desktop); 2-column grid on narrow phones; icons ~26px / ~23px |
| Latest Thinking | Four-column editorial feed with serif titles |
| Owner's Desk | Post–Latest chapter: insight → action tools (Cost Calculator, Compare) |
| Photography | Cinematic dark barbershop art direction |
| Serif headlines | **Newsreader** (local woff2, 600/700) for masthead + editorial titles |
| Condensed artwork | Barlow Condensed for `PRICE WITH INTENT` |
| UI / body | Existing Inter |

## Masthead statement (current)

- `PRACTICAL GUIDES.` / `INDEPENDENT THINKING.` / `BETTER BUSINESS DECISIONS.`
- Secondary: `BUILT FOR UK BARBERSHOP OWNERS.`
- Single vertical divider + one short red accent rule — no per-line dashes

## Owner's Desk (homepage chapter)

| Element | Value |
|---------|--------|
| Eyebrow | FROM INSIGHT TO ACTION |
| Heading | The Owner's Desk. |
| Tool 01 | `/barber-software-cost-calculator` (verified route) |
| Tool 02 | `/compare` (verified route) |
| Tone | Editorial decision desk — not SaaS feature cards |

## Explicitly rejected

| Rejected | Reason |
|----------|--------|
| Left editorial navigation rail | Founder rejected; felt weak / dashboard-adjacent |
| Sticky side menu for Insights | Conflicts with global sticky marketing nav |
| Inter-only masthead (provisional GATE 1) | Superseded for editorial H1 / feature titles |
| User-visible “Design Preview / Fixture” chrome | Page must look like a finished publication |
| Joined mosaic without dark gutters | Reference requires visible 12px page-background gaps |

## Master Bible supersessions (provisional only)

These **do not** rewrite the Master Bible file. They record founder override for GATE 1 visual identity:

1. **§3.3 “Do not introduce a fourth decorative font”** — superseded **for editorial display headlines** by **Newsreader** (was Source Serif 4 during first magazine pass). Inter / Antonio / Bebas / Barlow remain for UI and artwork roles.
2. Earlier GATE 1 working preference for left rail / Inter masthead hierarchy — **void**.
3. D3 (masthead typography scale) — locked visually to magazine reference until further owner change.
4. Homepage composition may include **The Owner's Desk** as a non-article utility chapter after Latest Thinking (preview only until public Insights ships).

Unchanged bible locks: same-domain Insights, no CMS MVP, no empty indexed hub, Precision Editorial restraint, authentic photography rules, gate approval process.

## Implementation notes

- Preview route remains `/design-preview/insights` (`noindex`).
- Fixture copy/images are design-only; not for sitemap or production collections.
- Photography sourced from existing project assets (`public/demo/gallery/*`, `public/reel-assets/carousel/chair-hero.jpg`), not cropped from the reference JPG.
- Tool links point at live marketing routes already in the app; no invented calculator/compare behaviour.
