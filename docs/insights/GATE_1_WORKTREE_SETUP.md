# GATE 1 — Worktree setup (izolacja od Online Booking)

**Status:** VERIFIED  
**Data:** 15 October 2026

## Branch Insights (PR-safe)

| Pole | Wartość |
|------|---------|
| Branch | `feat/kersivo-insights-editorial` |
| Base | `origin/main` @ `01333e2d891447fcc0e6c899ed204355d054e8c6` |
| Worktree | `C:/dev/kersivo-insights` |
| Tracking | `origin/main` (lokalny pointer; bez push w GATE 1) |

## Dlaczego nie `feat/kersivo-insights`

Pointer `feat/kersivo-insights` = `18ac393f` zawiera **77 commitów** unpublished Barbershop Online Booking / website-design / CUTSTATE względem `origin/main`. Founder wymaga, by Insights PR **nie** ciągnął tych zmian. Stary pointer **nie** został usunięty, zresetowany ani rebase’owany.

## Dokumentacja

- Skopiowano cały `docs/insights/` z `C:/dev/kersivo-barber-outreach/docs/insights/` (**copy**, nie move).
- Master Bible SHA256: `BB6D59A8228D17B22DB0F87BE8D02BA9F7DEB4493A2722C6E5DFEF07902B69D9` — **MATCH** źródło ↔ worktree.

## Potwierdzenie izolacji WIP

| Worktree | Branch | Stan |
|----------|--------|------|
| `C:/dev/kersivo-barber-outreach` | `feat/barbershop-online-booking-page-sections` | Brudny WIP **nietknięty** (bez stash/reset/switch) |
| `C:/dev/kersivo-insights` | `feat/kersivo-insights-editorial` | Czysty tip `origin/main` + untracked `docs/insights/` |

**Wszelka praca GATE 1+ wyłącznie w `C:/dev/kersivo-insights`.**
