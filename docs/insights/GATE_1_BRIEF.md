# GATE 1 — Premium Editorial Visual Identity

**Status:** `NEEDS REVIEW` — implementacja GATE 1 dostarczona; czeka na approve fundatora.  
**Baza brancha (PR-safe):** `feat/kersivo-insights-editorial` @ `origin/main` (`01333e2d`) — patrz [GATE_1_WORKTREE_SETUP.md](./GATE_1_WORKTREE_SETUP.md).  
**Uwaga:** stary pointer `feat/kersivo-insights` @ `18ac393f` pozostaje nietknięty (zawiera unpublished Online Booking — nie używać jako bazy PR).  
**SoT:** [KERSIVO_INSIGHTS_MASTER_BIBLE_v1.0.md](./KERSIVO_INSIGHTS_MASTER_BIBLE_v1.0.md) §§3–4, §12 GATE 1.

---

## Cel

Ustalic rozpoznawalną tożsamość wizualną **Precision Editorial** dla KERSIVO Insights — zanim powstanie pełny hub lub silnik treści.

## Scope (IN)

1. Tokeny editorial dziedziczące KERSIVO (`--bg`, surfaces, accent, typografia Inter / Antonio / Bebas).
2. Rytm dark index + reguły hairline / spacing / grid (12-col conceptual).
3. Cover art direction (photographic / data-led / typographic) — zasady, nie pełna biblioteka assetów.
4. Masthead Insights: eyebrow `KERSIVO / INSIGHTS`, working H1 `The Business Behind the Chair.`, jedna precyzyjna audience sentence.
5. Realistyczna kompozycja **desktop 1440px** i **mobile 390px** (screenshot / preview evidence z commit SHA).
6. Weryfikacja kontrastu WCAG 2.2 AA dla użytych par kolorów na dark shell.
7. Praca wyłącznie na `feat/kersivo-insights` (zalecany osobny worktree).

## Scope (OUT)

- Pełny hub `/insights` (to GATE 2).
- Szablon artykułu / light-paper A/B (GATE 3).
- Content collections, MDX, sitemap, nav entry, `og:type=article` (GATE 4).
- Sample articles w publicznych trasach produkcyjnych.
- Redesign globalnego `MarketingNavbar`.
- Merge / deploy / indexowanie.
- Nowy CMS.

## Acceptance (bible §12 GATE 1)

- Rozpoznawalny KERSIVO, premium bez dekoracji.
- Treść widoczna wcześnie (bez full-height pustego mastheadu).
- WCAG kontrast zweryfikowany.
- Brak redesignu globalnego nava.
- Owner acceptance **zanim** budowa kompletnego huba.

## OPEN decisions (nie zamykać w GATE 1 bez review)

| ID | Temat |
|----|--------|
| D1 | Finalny label — mockupy desktop/mobile (working: `KERSIVO / INSIGHTS`) |
| D3 | Skala masthead typography |
| D4 | Feature split 8/4 — dopiero wizualnie w GATE 2 z real content fixtures |

D2 (ivory reading canvas) → GATE 3.

## Kickoff checklist

- [ ] Fundator: jawne „start GATE 1”
- [ ] Czysty worktree / checkout `feat/kersivo-insights`
- [ ] Docs GATE 0 + bible obecne na branchu Insights
- [ ] Zero mieszania z brudnym WIP booking/website-design
