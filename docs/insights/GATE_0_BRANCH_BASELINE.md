# GATE 0 — Branch baseline dla KERSIVO Insights

**Status:** LOCKED for Insights development planning  
**Data:** 15 October 2026

## Wybrana baza

| Pole | Wartość |
|------|---------|
| Branch Insights | `feat/kersivo-insights` |
| Base SHA | `18ac393f74150e076032b108a9a6db5bfbf0641f` |
| Opis tipu | Tip czystej linii marketing/SEO (`feat/barbershop-online-booking-page-sections` @ commit), **bez** lokalnych uncommitted zmian |
| Utworzenie | `git branch feat/kersivo-insights 18ac393f…` — **tylko pointer**, bez checkout (WIP na innym branchu nietknięty) |
| Checkout w momencie GATE 0 | nadalostał na `feat/barbershop-online-booking-page-sections` (brudny tree) |

## Dlaczego nie `main` / `origin/main`

- Lokalny `main` (`7a5491bc`) jest **77 commitów za** aktywną linią marketingową.
- `origin/main` (`01333e2d`) jest tylko 1 commit ahead względem HEAD (strona `/seo-growth`), ale nadal **nie zawiera** 77 commitów LandingLayout/nav/SEO page-section work z linii feature.
- Insights musi reuse’ować aktualne `LandingLayout`, `MarketingNavbar`, tokeny i SEO utilities — stąd baza = tip linii marketingowej.

## Zasady bezpieczeństwa (obowiązkowe)

1. **Nie mieszać** Insights z niezacommitowanym WIP booking/website-design/email/favicon.
2. Przed pierwszym commitem Insights: checkout `feat/kersivo-insights` w czystym stanie (osobny worktree zalecany) albo po odparkowaniu WIP na jego własnym branchu.
3. Deliverable docs w `docs/insights/` powstały na dysku podczas GATE 0 — **pierwszy commit Insights powinien je zawrzeć na `feat/kersivo-insights`**, nie na branchu booking WIP.
4. Bez force-push, resetu WIP ani stash „w ciemno”.
5. Merge / deploy / indexowanie `/insights` tylko po jawnej zgodzie fundatora (bible §12 / §13).

## Rekomendowany start pracy (po kickoff GATE 1)

```text
# Preferowane: osobny worktree (nie rusza brudnego checkoutu)
git worktree add ../kersivo-insights feat/kersivo-insights

# Następnie przenieść / skopiować docs/insights deliverables do worktree
# i kontynuować GATE 1 tylko tam.
```

## Porównanie SHA (snapshot GATE 0)

| Ref | SHA |
|-----|-----|
| `feat/kersivo-insights` / marketing tip | `18ac393f74150e076032b108a9a6db5bfbf0641f` |
| lokalny `main` | `7a5491bcfb6b15729093bca05a24dc2f35803549` |
| `origin/main` | `01333e2d891447fcc0e6c899ed204355d054e8c6` |
