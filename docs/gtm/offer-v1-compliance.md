# KERSIVO Commercial Offer v1.0 — Compliance Tracker

**Źródło prawdy biznesowej:** [`KERSIVO Commercial Offer v1.0.pdf`](../../KERSIVO%20Commercial%20Offer%20v1.0.pdf)  
**Cel tego pliku:** pełna mapa §1–37 → status w produkcie / ops / copy. Nic nie wypada z listy tylko dlatego, że zaczęliśmy jeden sprint.

**Zasada pracy:** nie startujemy kodu „wyrywkowo”. Najpierw aktualizujemy wiersz w tej macierzy (status + work package), potem egzekucja. Claim marketingowy (§34) wolno włączyć dopiero gdy odpowiadający wiersz ma `DONE` w kolumnie Product.

Ostatni przegląd audytu: 2026-07-21

---

## Jak używać

1. Każdy punkt oferty ma **jeden wiersz** poniżej.
2. Kolumna **Work type** mówi, czy to kod, proces, czy copy (często kilka naraz).
3. Kolumna **WP** (work package) grupuje punkty w epiki — egzekucja idzie po WP, nie po „pierwszym lukowym featurze z głowy”.
4. Po zakończeniu pracy: `Status` → `DONE`, krótka notatka w **Notes** (PR / data).
5. Copy/Terms/FAQ (§34–36, Terms) ruszamy dopiero gdy powiązane WP produktowe są `DONE` lub świadomie oznaczone `WONT_CLAIM`.

### Status

| Status | Znaczenie |
|--------|-----------|
| `DONE` | Zgodne z ofertą w produkcie / procesie |
| `PARTIAL` | Część działa; brakuje reguł lub ścieżki z oferty |
| `MISSING` | Nie ma w produkcie / procesie |
| `OPS` | Świadomie poza kodem — checklista / playbook |
| `COPY_ONLY` | Wymaga tylko alignment tekstów (gdy produkt już OK) |
| `WONT_CLAIM` | Świadomie nie komunikujemy, dopóki nie zbudujemy |

### Work type

- `product` — feature / API / admin / jobs
- `ops` — proces ręczny, onboarding, domeny, support
- `copy` — landing, FAQ, Terms, claimsPolicy
- `legal` — Terms / Privacy / zgody

---

## Work packages (kolejność egzekucji)

Egzekucja idzie **po WP**, nie po pojedynczym „najciekawszym” lukowym punkcie. WP można rozbić na PR-y, ale tracker aktualizujemy na poziomie wierszy §X.

| WP | Nazwa | Cel | Blokuje claimy |
|----|-------|-----|----------------|
| **WP-A** | Public booking truth | Live `/book`, create bez owner-only, manage cancel/reschedule | Online booking |
| **WP-B** | Deposits £5 | Toggle salonu, stałe £5, Stripe salonu, reguły kwoty | Online booking deposits |
| **WP-C** | Policy 24h | Defaulty 24h, max 2 reschedule, refund/forfeit, shop-forced reschedule | — |
| **WP-D** | Email reminders job | Cron 24h, skip &lt;24h od create, cancel na change | Email reminders (jako prawda, nie tylko confirm) |
| **WP-E** | RBAC roles | Owner / Manager / Barber, invites, API+UI gates | Unlimited dashboard users |
| **WP-F** | SMS + allowance | Provider, job, monthly allowance (no public £ figure), usage UI, critical SMS | SMS appointment reminders included |
| **WP-G** | Client CRM parity | Block, merge/undo, archive, anonymise, duplicate hint | — |
| **WP-H** | Retail parity | Statusy, KRV number, day-7 reminder, full/partial refund | Retail pickup shop (pełna prawda) |
| **WP-I** | Billing lifecycle | Cancel anytime semantics, grace 7/8/30, suspend, 60d retention/export | Cancel anytime (pełna prawda) |
| **WP-J** | Launch & support ops | Onboarding form audit, Approve & launch log, support form, email From/Reply-To | — |
| **WP-K** | Reports naming | Booked/Completed service value — nie „revenue” | — |
| **WP-L** | GTM alignment | claimsPolicy, FAQ, Terms, landing, AI knowledge | Wszystkie §34 po DONE produktowym |
| **WP-M** | Pure ops playbooks | Domeny, migracja CSV, VAT, portfolio consent, SLA, minor changes | — |

**Następny WP do startu:** żaden — najpierw akceptacja tej macierzy i ewentualne doprecyzowanie priorytetów WP-A…F.

---

## Macierz §1–37

| § | Temat | Status | Work type | WP | Priorytet | Gap (skrót) | Notes |
|---|-------|--------|-----------|-----|-----------|-------------|-------|
| 1 | Pozycjonowanie produktu | `PARTIAL` | copy, ops | WP-L | P2 | Marka/obietnica OK w duchu; copy do ujednolicenia pod v1.0 | |
| 2 | Cena £39 / subskrypcja / VAT | `DONE` | product, copy | WP-I, WP-L | P1 | SaaS £39 (3900p, month, qty1, no tax, immediate). Copy §2: per-location, billing day, no pause, VAT exact, price-change 30d w claimsPolicy + Terms/FAQ/landing/reel (21 Jul 2026). Lifecycle cancel/grace nadal §29/§30. | |
| 3 | Brak setup fee / konfiguracja w dashboardzie | `DONE` | product, copy | WP-L | P2 | No setup fee live (`SHOW_SETUP_PLAN_CARDS=false`). Copy §3: included setup + owner self-config (barbers/services/prices/hours/products; shop info = name/town/logo). Brand/domain/SSL = ops in £39. Reel £199 removed (21 Jul 2026). | |
| 4 | Strona internetowa + Powered by KERSIVO | `PARTIAL` | product, ops, copy | WP-M, WP-L | P2 | Copy/Terms §4 aligned (21 Jul 2026): standard scope, not-bespoke, Powered by on **customer** shop sites only. Badge = **OPS manual** at each shop-site delivery (never on kersivo.co.uk). Full multi-page tenant CMS still not in this repo. | |
| 5 | Domena (nowa/istniejąca, limit £30) | `OPS` | ops, copy | WP-M, WP-L | P2 | Copy/Terms §5 aligned (21 Jul 2026): new vs existing, auth text, £30 allowance, no passwords by email. Public claim: Your own domain included. Tally checkbox = `DOMAIN_AUTH_TEXT` post-purchase. Registrar/DNS/SSL delivery remains OPS. | |
| 6 | Onboarding form + preview + Approve & launch audit | `DONE` | product, ops, copy | WP-J, WP-L | P1 | Copy/Terms §6 aligned (21 Jul 2026). **H05 cz.1 DONE (29 Jul 2026):** Terms acceptance at checkout. **H05 cz.2 DONE (29 Jul 2026):** Private preview shell (`/admin/site-preview`) + Approve & launch toolbar + `SiteLaunchEvent` audit (who/when/version/go-live) + OPS endpoint `POST /api/ops/site-preview`. DNS remains OPS. | |
| 7 | Brakujące materiały / no fake stock | `OPS` | ops, copy | WP-M, WP-L | P3 | Copy/Terms §7 aligned (21 Jul 2026): optional fallbacks, critical hold, no fake stock. Delivery playbook = OPS. | |
| 8 | Zakres planu £39 (lista feature) | `PARTIAL` | product, copy | WP-A…H, WP-L | P0 | Copy aligned: highlights + pills + FULL_LIST; **SMS appointment reminders** (plain claim; Terms = monthly allowance, no figure). Status stays PARTIAL — produktowy agregat WP-A…H (deposits, SMS WP-F engineering, reports, itd.). | |
| 9 | Limity / fair use / unlimited users | `PARTIAL` | product, copy | WP-E, WP-L | P0 | Copy/Terms §9 aligned (21 Jul 2026): `FAIR_USE_*` w claimsPolicy + Terms `#fair-use` + FAQ/AI. Unlimited within one location (incl. dashboard users) = commercial entitlement. Produkt: dziś 1 shop/owner; **unlimited dashboard users wymaga WP-E RBAC**. | |
| 10 | Role: Owner / Manager / Barber | `PARTIAL` | product | WP-E | P0 | **Fazy 1–3 code (21 Jul 2026):** ShopMember/Invite, matrix + API gates, Team UI, sidebar filter, **booking mutations + clients scoped for BARBER**, null-barberId blocked. Pozostaje: szersze E2E 403 tests, multi-shop switcher, polish Team CSS. | |
| 11 | Booking flow klienta | `DONE` | product | WP-A | P0 | Marketing `/book` sandbox; live tenant `/book/[shopId]` + `POST /api/public/bookings/[shopId]/create` (27 Jul 2026). | |
| 12 | Depozyty £5 fixed | `DONE` | product | WP-B | P0 | Toggle + Connect Express + £5 Checkout + PENDING_PAYMENT → BOOKED webhook; demo/unpaid hard-off (27 Jul 2026). | |
| 13 | Email + SMS reminders + allowance UI | `PARTIAL` | product, copy | WP-D, WP-F | P0 | **Copy:** SMS included (`SMS_INCLUDED_CLAIM`). **Produkt:** confirm e-mail + scheduled email reminder cron WP-D (29 Jul 2026). SMS provider/job/usage UI = WP-F (w toku) | |
| 14 | Zmiana terminu (client + shop-forced) | `DONE` | product | WP-C | P0 | Defaults 24h; maxClientReschedules=2; shop-forced `POST .../force-reschedule` (27 Jul 2026). | |
| 15 | Anulowanie / no-show / refundy depozytu | `DONE` | product | WP-C | P0 | Refund in-window / shop cancel; forfeit outside window + NO_SHOW; expire unpaid holds cron (27 Jul 2026). | |
| 16 | Retail pickup shop | `PARTIAL` | product | WP-H | P1 | Checkout działa; `READY_FOR_PICKUP` vs oferta; reminder dzień 7; numer KRV | |
| 17 | Refundy retail (full/partial + audit) | `MISSING` | product | WP-H | P1 | Brak API refund w `src/pages/api` | |
| 18 | Profile klientów (merge/archive/anonymise) | `PARTIAL` | product | WP-G | P1 | CRM ops + notes/tags; brak merge/archive/anonymise | |
| 19 | Blokowanie klientów (booking only) | `MISSING` | product | WP-G | P1 | Brak modelu blokady + kategorii + audit | |
| 20 | Reports (booking metrics, naming) | `PARTIAL` | product, copy | WP-K | P2 | Analytics są; ujednolicić nazwy (nie „revenue”) | |
| 21 | Sales (retail only, osobna sekcja) | `PARTIAL` | product, copy | WP-K | P2 | Sales studio jest; dopiąć waiting 7–13 / 14+ jeśli brak | |
| 22 | Migracja danych | `OPS` | ops, copy | WP-M, WP-L | P2 | Playbook CSV; claim ostrożny | |
| 23 | Support (email → form w dashboardzie) | `PARTIAL` | product, ops | WP-J | P2 | hello@ działa jako proces; brak in-app form | |
| 24 | Service availability / brak SLA | `COPY_ONLY` | copy, legal | WP-L | P3 | Terms alignment | |
| 25 | Drobne zmiany strony | `OPS` | ops, copy | WP-M | P3 | Playbook; nie obiecywać N godzin | |
| 26 | Odpowiedzialność za dane/treści | `COPY_ONLY` | legal | WP-L | P3 | Terms | |
| 27 | Portfolio / użycie marki (opt-in) | `MISSING` | product, ops | WP-J | P3 | Zgoda nie-domyślna — brak w checkout/onboarding | |
| 28 | Infrastruktura e-mail (From / Reply-To) | `PARTIAL` | product | WP-J | P2 | Resend jest; sprawdzić/ustawić From `[Shop] via KERSIVO` + Reply-To salonu | |
| 29 | Anulowanie subskrypcji (no pause) | `PARTIAL` | product, copy | WP-I | P1 | Stripe cancel; dopiąć UX „active do końca okresu” | |
| 30 | Nieudane płatności / grace / suspend | `PARTIAL` | product | WP-I | P1 | Grace 7d + SUSPENDED od dnia 8 (cron); public booking off; admin billing+CSV. | |
| 31 | Retencja 60 dni + 1× CSV export | `PARTIAL` | product, ops | WP-I | P1 | **Produkt:** retencja self-serve CSV = **30 dni** (align Terms/FAQ). 1× download w dashboardzie. | |
| 32 | Ownership po zakończeniu | `COPY_ONLY` | legal | WP-L | P3 | Terms | |
| 33 | Refund pierwszej £39 | `OPS` | ops, legal | WP-M, WP-L | P3 | Polityka goodwill — nie auto w kodzie | |
| 34 | Dozwolone claimy marketingowe | `PARTIAL` | copy | WP-L | P0* | SMS included claim włączony (owner). Scheduled email reminder cron = WP-D DONE (29 Jul 2026). Reszta §34 (booking deposits claim parity, RBAC unlimited users) nadal zależy od WP-B/E / copy | |
| 35 | Niedozwolone claimy | `PARTIAL` | copy | WP-L | P1 | Część już unikana; audyt landing/AI/docs | |
| 36 | Główna obietnica oferty | `COPY_ONLY` | copy | WP-L | P2 | Po produktowych DONE | |
| 37 | Status dokumentu / proces dalszy | `DONE` | ops | — | — | Ten tracker = wykonanie §37 | |

---

## Checklist egzekucji (nie koduj poza tą listą)

Używaj jako „czy wiemy, gdzie jesteśmy?”:

- [ ] Macierz zaakceptowana jako źródło prawdy wdrożeniowej
- [ ] Kolejność WP-A → WP-L zatwierdzona (lub świadomie przestawiona w tej sekcji)
- [x] WP-A Public booking — `DONE`
- [x] WP-B Deposits — `DONE`
- [x] WP-C Policy 24h — `DONE`
- [x] WP-D Email reminders — `DONE`
- [ ] WP-E RBAC — `DONE`
- [ ] WP-F SMS + allowance — `DONE`
- [ ] WP-G Client CRM — `DONE`
- [ ] WP-H Retail parity — `DONE`
- [ ] WP-I Billing lifecycle — `DONE`
- [ ] WP-J Launch & support — `DONE`
- [ ] WP-K Reports naming — `DONE`
- [ ] WP-M Ops playbooks — checklisti spisane
- [ ] WP-L GTM/copy/Terms — dopiero na końcu

---

## Świadome decyzje (żeby nie było „nie wiadomo”)

1. **Nie startujemy kodu**, dopóki ta macierz jest zaakceptowana i wybrany jest pierwszy WP.
2. **Jeden WP naraz** (lub jasno równoległe WP bez wspólnych plików auth/billing).
3. **Każdy PR** musi wymieniać `§X` + `WP-Y` w opisie i aktualizować ten plik.
4. **Manual booking** (§11): oferta mówi „nie posiadamy jako zatwierdzonego elementu”. Endpoint `POST /api/admin/bookings/manual` usunięty w P0-4 (omijał availability). Funkcji manual booking nie ma ani wewnętrznie, ani w customer-facing claims.
5. **SMS w claimsPolicy:** public copy uses plain `SMS_INCLUDED_CLAIM` (`SMS appointment reminders`) — never Unlimited / £ figure / message count. Terms use `SMS_MONTHLY_ALLOWANCE_TERMS` (monthly allowance, no published amount). Engineering WP-F (provider, job, usage UI) nadal TODO — nie mylić copy z DONE produktu.
6. Punkty `OPS` / `COPY_ONLY` nie znikają — mają osobne checklisty w WP-M / WP-L.
7. **§4 Powered by KERSIVO (OPS):** przy go-live każdej strony salonu ręcznie wstaw subtelne „Powered by KERSIVO” z linkiem do `https://kersivo.co.uk`; nieusuwalne w planie £39; bez innych reklam/banerów KERSIVO na stronie klienta. **Nigdy** nie umieszczaj tego badge na marketing site kersivo.co.uk.
8. **§5 Domena (OPS):** jedna standardowa domena / lokalizacja. Tally po zakupie (nowa domena): checkbox z `DOMAIN_AUTH_TEXT` z `claimsPolicy.ts`. Limit £30/rok — sprawdź przed rejestracją; premium/aftermarket → alternatywa lub dopłata. Istniejąca domena: DNS/SSL bez wymuszonego transferu; **nigdy** nie proś o hasła rejestratora zwykłym e-mailem.
9. **§6 Onboarding / launch:** copy w Terms opisuje materiały, billing od zakupu, timeline 1–2 weeks after materials, preview + Approve and launch, DNS po approve. Public copy **nie** opisuje przyszłego hostingu preview ani mechaniki przycisku. **H05 cz.1:** akceptacja Terms przy checkout = DONE (`LegalAcceptance` + API gate). **H05 cz.2:** private preview shell + Approve & launch + `SiteLaunchEvent` audit = DONE. OPS ustawia preview URL via `POST /api/ops/site-preview` (Bearer CRON_SECRET, body: `{ shopId, previewUrl, siteVersion }`). DNS nadal ręcznie po `launchApprovedAt`.
10. **§7 Brakujące materiały (OPS):** opcjonalne braki → neutral avatar / ukryta galeria / typografia zamiast logo / podstawowe teksty; kluczowe braki (adres/kontakt) mogą wstrzymać launch; **zakaz** stocków sugerujących prawdziwy salon/zespół/klientów (`NO_FAKE_STOCK_CLAIM`).
---

## Szybki indeks: co jest „fałszywą obietnicą” dziś vs oferta

Jeśli whitelabelowalibyśmy landing pod pełną ofertę v1.0 **teraz**, te claimy byłyby nieprawdziwe:

| Claim z §34 | Wymaga DONE |
|-------------|-------------|
| Online booking (+ flow klienta) | WP-A |
| Online booking deposits | WP-B |
| SMS appointment reminders included | WP-F (copy DONE; engineering open) |
| Unlimited … users (dashboard) | WP-E |
| Email reminders (jako scheduled, nie tylko confirm) | WP-D — `DONE` (29 Jul 2026) |
| Cancel anytime (pełny lifecycle) | WP-I (częściowo już OK) |

Reszta §34 (website, domain, 0% commission, retail pickup, hosting/SSL, migration assistance, £39) jest bliżej prawdy operacyjnej / częściowo produktowej — nadal wymaga WP-L do precyzji disclaimerów.
