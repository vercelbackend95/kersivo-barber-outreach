# GATE 1 — Visual Polish + The Owner's Desk

**Status:** `NEEDS REVIEW` — czeka na approve fundatora; **STOP** przed GATE 2  
**Data:** 16 October 2026  
**Worktree / branch:** `C:/dev/kersivo-insights` · `feat/kersivo-insights-editorial`  
**Preview (noindex):** `http://127.0.0.1:4335/design-preview/insights`  
**Reference:** `docs/insights/gate1-reference/approved-magazine-direction.jpg`  
**Commit / push / merge / deploy:** brak

---

## 1. Co zmieniono

| Obszar | Zmiana |
|--------|--------|
| Mosaic gutters | `--ins-gap: 12px`; tło luk = page bg; niezależne bordery paneli |
| Typografia | **Newsreader** 600/700 (self-host) zamiast Source Serif 4 na H1 / feature / Latest / Desk |
| Masthead | Grid ~72/28; aside `align-self: center`; nowa statement copy |
| Topic icons | 26px desktop / 23px mobile; 2-col grid na ≤1023px |
| Mobile | Natural H1 wrap; bottom-up scrim; body ≥16px; aside ukryty ≤380px |
| Owner's Desk | Nowa sekcja po Latest Thinking; linki `/barber-software-cost-calculator`, `/compare` |

## 2. Zmienione / dodane pliki

- `src/styles/components/insights-gate1.css`
- `src/styles/components/insights-tokens.css`
- `src/styles/components/fonts-insights.css`
- `public/fonts/newsreader-latin-600-normal.woff2`
- `public/fonts/newsreader-latin-700-normal.woff2`
- `src/components/insights/InsightsOwnersDesk.astro` *(new)*
- `src/components/insights/InsightsTopicStrip.astro`
- `src/lib/insights/gate1Preview.ts`
- `src/pages/design-preview/insights/index.astro`
- `scripts/capture-insights-gate1.mjs`
- `docs/insights/GATE_1_DESIGN_DECISION_MAGAZINE_v1.md`
- `docs/insights/GATE_1_REPORT.md`
- `package.json` / lock (`@fontsource/newsreader`)

## 3. Pomiary Playwright

| Viewport | H1 lines | Font | Gap | Icon | Overflow |
|----------|----------|------|-----|------|----------|
| 1440×900 | **2** | Newsreader | **12px** | **26** | no |
| 390×844 | 2 | Newsreader | 12px | **23** | no |
| 320×640 | 2 | Newsreader | 12px | 23 | no |
| 768×1024 | 2 | Newsreader | 12px | 23 | no |

Mosaic height @1440: **353px**. Owner's Desk present pod Latest Thinking.

## 4. Screenshoty

- `docs/insights/gate1-preview/desktop-1440-viewport.png`
- `docs/insights/gate1-preview/desktop-1440-full.png`
- `docs/insights/gate1-preview/mobile-390-viewport.png`
- `docs/insights/gate1-preview/mobile-390-full.png`
- `docs/insights/gate1-preview/mobile-320-viewport.png`
- `docs/insights/gate1-preview/mobile-320-full.png`
- `docs/insights/gate1-preview/tablet-768-viewport.png`
- `docs/insights/gate1-preview/tablet-768-full.png`
- `docs/insights/gate1-preview/owners-desk-desktop.png`
- `docs/insights/gate1-preview/owners-desk-mobile.png`

## 5. Ocena vs reference

- H1 2 linie + Newsreader — bliżej „serious journal”
- Widoczne ciemne guttery 12px między panelami mosaic
- Statement wycentrowany, bez per-line dashes, nowa copy
- Ikony topiców wyraźnie większe
- Owner's Desk daje zmianę rytmu po fotograficznym Latest

## 6. Pozostałe różnice

1. Kadry mosaic nadal z istniejącego gallery — nie 1:1 z reference (nożyczki / barber pole).
2. Centre „PRICE WITH INTENT” — burgundy + blend; reference ma silniejszy portret.
3. Na bardzo wąskich ekranach (≤380px) statement aside jest ukryty dla komfortu czytania.

## 7. Bezpieczeństwo

- Tylko worktree Insights · preview `noindex`
- Global nav / sitemap / robots / production / booking — nietknięte
- Brak commit / push / merge / GATE 2
