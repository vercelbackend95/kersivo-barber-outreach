# GATE 0 — KERSIVO Insights: audyt i baseline

**Status bramki:** `APPROVED` (fundator zatwierdził plan GATE 0 przez polecenie implementacji, 15 Oct 2026)  
**Poprzedni status audytu:** `NEEDS REVIEW`  
**Tryb wykonania:** wyłącznie deliverable baseline — bez komponentów bloga, bez zmian nav/SEO/sitemap w kodzie aplikacji, bez commit/push/deploy/merge.  
**Źródło prawdy:** [KERSIVO_INSIGHTS_MASTER_BIBLE_v1.0.md](./KERSIVO_INSIGHTS_MASTER_BIBLE_v1.0.md)

---

## A. Repozytorium, branch i working tree — VERIFIED

| Fakt | Wartość |
|------|---------|
| Working directory / git root | `C:/dev/kersivo-barber-outreach` |
| Remote | `origin` → `https://github.com/vercelbackend95/kersivo-barber-outreach.git` |
| Branch w momencie audytu | `feat/barbershop-online-booking-page-sections` |
| HEAD SHA (baza Insights) | `18ac393f74150e076032b108a9a6db5bfbf0641f` |
| Tracking | `origin/feat/barbershop-online-booking-page-sections` |
| Working tree | **brudny** — wiele zmian SEO/booking/website-design + untracked assets/reviews |
| Lokalny `main` | `7a5491bc` — **77 commitów za** HEAD |
| `origin/main` | `01333e2d` — **1 commit** (`/seo-growth`) nieobecny w HEAD |

**Wniosek:** `main` nie jest najnowszą linią marketing/SEO. Insights nie wolno budować na brudnym WIP bieżącego checkoutu.

---

## B. Architektura istotna dla Insights — VERIFIED

| Obszar | Fakt |
|--------|------|
| Stack | Astro 7.2.2, React, Tailwind Vite, Sentry, `@astrojs/vercel` |
| Config | `astro.config.mjs`: `output: 'server'`, `site: https://kersivo.co.uk`; bez MDX, bez `@astrojs/sitemap`, bez `trailingSlash` |
| Layout | `src/layouts/LandingLayout.astro` — MarketingNavbar, SeoHead, GA, cookie consent, ClientRouter, RouteTransitionRoot, fonts-landing + preload 4 fontów, `en-GB` |
| Footer | `src/components/footer50.astro` (montowany per-page, nie w layoutcie) |
| Nav SoT | `src/lib/nav/marketingNavigation.ts` — Resources > **Guides puste** (items tylko tools + help) |
| Breakpoint nav | Desktop od `64rem`; `--mnav-h` 3.75rem / 4.25rem |
| Tokeny | `src/styles/tokens.css` — `--bg #0b0d10`, `--fg #f1eee8`, `--muted #b7bdc7`, surfaces, `--accent #d72638`, `--accent-text #dc4e5b`, Bebas / Inter; Antonio self-hosted |
| Container | `.container` max 72rem; nav inner ~80rem |
| SEO | `src/lib/seo/meta.ts`, `SeoHead.astro`, `kersivoEntityJsonLd.ts` |
| Sitemap | Ręczny allowlist `marketingSitemap.ts` + prerender `sitemap.xml.ts` |
| Robots | `robots.txt.ts` → `Sitemap: {site}/sitemap.xml` |
| Canonical | Bez trailing slash poza `/` |
| OgType | Tylko `'website' \| 'product'` — brak `'article'` |
| Prerender | Marketing SSR by default; `prerender = true` praktycznie tylko sitemap; brak `getStaticPaths` |
| Content collections / `/insights` / MDX | **Absent** |

---

## C. Punkty integracji (reuse)

**Reuse bez redesignu globalnego:** LandingLayout, MarketingNavbar*, marketingNavigation.ts, tokens.css, fonts-landing.css, global.css, footer50, meta.ts, SeoHead, kersivoEntityJsonLd, marketingSitemap + sitemap.xml + robots, consent/GA, route transitions.

**Dopiero GATE 4 (nie teraz):** `og:type=article`, wpis Guides → Insights, match subtree `/insights`, published-only w sitemap.

---

## D. Konflikty i ryzyka

| Ryzyko | Label |
|--------|-------|
| Brudny WIP na branchu SEO/booking — mieszanie Insights | **VERIFIED** |
| Brak collections / MDX / `/insights` | **VERIFIED** |
| Server mode → jawne `prerender = true` + `getStaticPaths` | **VERIFIED** |
| OgType bez `article` | **VERIFIED** |
| Sitemap allowlist — drafty tylko przy twardym filtrze published | **VERIFIED** |
| Intent vs compare / alternatives / barbershop-* (bible §9.1) | **VERIFIED** |
| Preload 4 fontów na Landing — audyt wpływu | gap → GATE 5 |
| Lighthouse / CWV liczby | **UNVERIFIED / no recorded scores** |
| Runtime trailing-slash redirects | **UNVERIFIED** |
| Lighthouse w audycie GATE 0 | **BLOCKED** (zakaz install; brak skryptu) |

---

## E. Strategia branchy — ZATWIERDZONA

1. Nie budować Insights na brudnym checkoutcie `feat/barbershop-online-booking-page-sections`.
2. Pozostawić obecny WIP nietknięty (bez stash/reset na WIP).
3. Dedykowany branch **`feat/kersivo-insights`** utworzony jako wskaźnik na czysty tip linii marketingowej (bez checkoutu).
4. **Baza SHA:** `18ac393f74150e076032b108a9a6db5bfbf0641f` — tip linii z LandingLayout / nav / SEO ahead of `main`.
5. Osobne PR-y; bez merge / deploy / index bez jawnej zgody fundatora.
6. Master bible skopiowany do `docs/insights/` (ten katalog).

Szczegóły: [GATE_0_BRANCH_BASELINE.md](./GATE_0_BRANCH_BASELINE.md).

---

## F. Minimalna struktura plików (bible §11 — jeszcze nie tworzyć w kodzie)

```text
src/content.config.ts
src/content/insights/
src/lib/insights/{schema,published,categories,routes,related,seo}.ts
src/pages/insights/{index,[slug],page/[page],category/[category]}.astro
src/components/insights/*.astro
src/styles/components/insights*.css
```

Markdown first; MDX tylko jeśli konieczne (D5). URL: `/insights`, `/insights/{slug}`, `/insights/page/n`.

---

## G. Design constraints (Precision Editorial)

- Ciemny shell KERSIVO; accent `#D72638` / `#DC4E5B` oszczędnie; bez nowych fontów / glow / branding gradients.
- Inter body; Antonio/Bebas selektywnie; H1 artykułu = Inter, nie Bebas body.
- Outer ~1280–1360px; measure ~680–740px; hairline; radius 4–12px.
- D2 ivory vs all-dark = OPEN do GATE 3.
- `components/editorial/*` = SEO landing kit, nie magazyn Insights.

---

## H. SEO / a11y / performance

- Hub indexowalny dopiero po prawdziwej treści (GATE 6).
- Drafty poza routes/sitemap; fixtures tylko test/preview.
- Schema: CollectionPage + Article/BlogPosting; publisher = istniejące Organization `@id`.
- Pagination: real `<a>`, self-canonical page 2+.
- A11y: WCAG 2.2 AA, jeden H1, landmarks, reduced-motion.
- Cele perf bible §10 ≠ pomiary; baseline lab **UNVERIFIED**.
- Kandydaci przyszłego baseline (bez liczb): `/`, `/compare` lub `/fresha-alternative`, lekka strona informacyjna.

---

## I. Decyzje fundatora (GATE 0)

| ID | Decyzja | Status |
|----|---------|--------|
| D1 | Tożsamość editorial `KERSIVO / INSIGHTS`, route `/insights` | **APPROVED** jako working identity do GATE 1 |
| Branch | Baza `18ac393f` → `feat/kersivo-insights` | **APPROVED / CREATED** (pointer, bez checkout) |
| SoT w repo | Bible w `docs/insights/` | **DONE** |
| D2–D7 | Canvas, typografia, feature split, MDX, publish threshold, category indexes | **OPEN** (poza GATE 0) |
| GATE 1 start | Implementacja wizualna | Wymaga **osobnego** jawnego kickoff (patrz brief) |

---

## J. Zakres GATE 1 (nie rozpoczęty automatycznie)

Pełny brief: [GATE_1_BRIEF.md](./GATE_1_BRIEF.md).

Skrót: tylko tożsamość wizualna Precision Editorial (tokeny, masthead, rytm, kompozycja 1440 + 390). Bez pełnego huba, collections produkcyjnych, zmian sitemap/nav/SEO, sample articles w public routes, MDX, merge/deploy.

---

## Definition of done — GATE 0

- [x] Zweryfikowany repo / branch / SHA / dirty tree
- [x] Zmapowana architektura i punkty integracji
- [x] Zidentyfikowane ryzyka z labelami VERIFIED / UNVERIFIED / BLOCKED
- [x] Strategia branchy + utworzony pointer `feat/kersivo-insights`
- [x] Master bible w `docs/insights/`
- [x] Handoff + brief GATE 1
- [x] Brak zmian w kodzie aplikacji marketingowej / SaaS
- [x] Brak auto-startu GATE 1

**GATE 0 zamknięty. Czekamy na jawne polecenie startu GATE 1.**
