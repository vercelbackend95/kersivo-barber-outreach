# Plan GEO / AEO dla KERSIVO (widoczność w wyszukiwaniu AI)

Napisany 25 listopada 2026 na podstawie listy pojęć „wyszukiwanie AI 2026” i stanu repozytorium na `main` @ `b206db03`.
Powiązane dokumenty: `ai-visibility-playbook.md` (działania poza stroną, test 10 promptów), `audit-2026-11-growth.md`, `content-plan-buying-searches.md`, `ROADMAP.md`.

## Skąd ten plan

Search Console (15 października – 11 listopada 2026) pokazuje długie, „czatowe” pytania na pozycjach 3–6 bez kliknięć, np. „how should a barbershop handle walk-ins during peak hours?” (119 wyświetleń). AI pobiera nasze strony, ale nie cytuje ich i nie wymienia marki. Artykuły Insights, które łapią te pytania, zaczynają się od narracji, a odpowiedź pojawia się dopiero w połowie tekstu.

## Co już jest (nie robić drugi raz)

| Pojęcie z listy | Stan w KERSIVO |
|---|---|
| SEO (fundament) | Batche 1–7: szybkość, kanoniczne adresy, sitemap z `lastmod`, schema w jednym `@graph`, IndexNow codziennie |
| Platformy i boty | `robots.txt` wpuszcza OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User; Googlebot i Bingbot pod `*` |
| llms.txt | `/llms.txt` generowany z `claimsPolicy`, z listą stron produktu, porównań, narzędzi i Insights |
| Answer-first (strony sprzedażowe) | Blok „In short” na `/compare` i 10 stronach alternatyw; `PRICING_QUICK_ANSWER` na `/pricing`; bezpośrednie odpowiedzi pod H1 na 4 darmowych narzędziach; definicja encji na `/about` |
| Entity | Jedno zdanie opisu (`KERSIVO_ENTITY_DESCRIPTION`) w Organization JSON-LD, `/about`, `/llms.txt`; stałe `@id`; logo 512 px; `sameAs` z profili społecznościowych |
| Non-commodity content | Datowane, sprawdzone ceny konkurencji w `*Facts.ts`, raport opłat `/barber-booking-fees-uk`, kalkulatory, modele P&L w Insights |
| Metryki | Miesięczny test 10 promptów w 4 asystentach (playbook, sekcja 6); kanał „AI assistants” w GA4 (`docs/analytics/ga4-setup.md`) |

## Etapy

Kolejność zgodna z priorytetami z listy. Każdy etap to osobna gałąź i PR. „Kod” = robi Claude, „Ty” = działania poza repozytorium.

### Etap 1. GEO / AEO: krótkie odpowiedzi na początku artykułów Insights (kod) ✅ PR #315

Cel: każdy artykuł Insights zaczyna się od odpowiedzi, którą AI może zacytować w całości.

1. Blok „Short answer” pod zdjęciem otwierającym każdego z 20 artykułów: pytanie, na które odpowiada artykuł (tak, jak zadaje je właściciel), i odpowiedź w 40–80 słowach.
2. Odpowiedź streszcza wyłącznie to, co artykuł już mówi: żadnych nowych liczb ani twierdzeń. Jedno źródło prawdy: `src/lib/insights/insightsShortAnswers.ts`.
3. Ta sama odpowiedź trafia do Article JSON-LD (`abstract`) i do `/llms.txt` (opis linku do artykułu zamiast samego meta description).
4. Test pilnuje, że każdy opublikowany artykuł ma krótką odpowiedź, że ma 40–80 słów, że stoi przed pierwszym H2 i że nie zawiera zakazanych sformułowań.
5. Data „Updated” w artykułach się nie zmienia (treść merytoryczna ta sama), więc IndexNow nie wyśle ich ponownie; zamiast tego poproś o ponowne zindeksowanie 7 najczęściej wyświetlanych artykułów w GSC i Bing (lista w changelogu).

Miernik: CTR i kliknięcia dla pytań czatowych w GSC po 4–6 tygodniach; cytowania `/insights/*` w miesięcznym teście promptów.

### Etap 2. Answer-first + query fan-out (kod) ✅ PR #316 (punkty 1–4, `geo-aeo-2-fan-out-map.md`); punkt 5: sekcje gotowe, artykuły czekają na Ciebie

AI rozbija jedno pytanie na kilka podpytań („best barber booking software UK” → koszt dla 3 foteli, prowizje, depozyty, czy klient musi mieć aplikację, jak przenieść klientów, czy działa z Google). Strona, która odpowiada na podpytania w osobnych, nazwanych fragmentach, trafia do większej liczby z nich.

1. Mapa podpytań dla stron właścicieli fraz (`/`, `/compare`, `/pricing`, `/starter`, `/barbershop-websites`, `/barbershop-online-booking`, 4 główne alternatywy): lista 6–10 podpytań na stronę, z oznaczeniem, czy strona już na nie odpowiada.
2. Brakujące odpowiedzi jako krótkie sekcje lub pytania FAQ (2–4 zdania, pierwsze zdanie = odpowiedź). H2 i H3 w formie pytań tam, gdzie to naturalne.
3. Krótkie bloki odpowiedzi („In short” lub odpowiednik) na stronach, które ich jeszcze nie mają: `/`, `/starter`, `/barbershop-websites`, `/barbershop-online-booking`, `/barbershop-reports`, `/barbershop-retail-pickup`, `/booksy-vs-fresha`, `/kersivo-vs-booksy` (najpierw sprawdzić, które już mają definicję pod H1).
4. Pytania czatowe z GSC (np. walk-ins w godzinach szczytu) jako H2 w istniejących artykułach, jeśli artykuł na nie odpowiada.
5. Realizacja priorytetu P1 z `content-plan-buying-searches.md` (opłaty Booksy, jak odejść z Booksy, opłaty Fresha, własna strona vs marketplace, depozyty według systemu): każdy tekst pisany od razu w formie answer-first.
   Stan 26.11.2026: sekcje już są na stronach — opłaty Booksy (`/booksy-alternative#booksy-pricing`), odejście z Booksy (`#switching`), opłaty Fresha (`/fresha-alternative#costs`), depozyty (`/compare#deposits`), opłaty kartowe (`/barber-booking-fees-uk#card-fees`). Zostaje nowy artykuł Insights „Booking website vs marketplace” (pozycja 4 planu treści): artykuły Insights publikujemy tylko po Twojej akceptacji w Notion, więc to osobny krok.

### Etap 3. Wzmianki o marce i earned media (kod + Ty)

Kod:
1. Pętla „Powered by KERSIVO”: link z nazwą marki na stronie rezerwacji `/book/[shopId]`, na ekranie potwierdzenia i w stopce stron klientów Full, z UTM `powered-by`; `rel="nofollow"` na rezerwacji i potwierdzeniu. Wymaga Twojej decyzji co do wyglądu i tego, czy klienci Full mogą to wyłączyć.
2. Raport opłat `/barber-booking-fees-uk` jako materiał dla prasy: wersja do pobrania (CSV) i gotowy akapit do cytowania z datą i metodologią.
3. Strona `/press` lub sekcja na `/about`: opis marki, logo do pobrania, fakty do cytowania (bez nazwiska założyciela).

Ty (szczegóły w `ai-visibility-playbook.md`, sekcje 2–5):
1. Bing Webmaster Tools (najpierw, bo z indeksu Bing korzysta ChatGPT i Copilot).
2. Capterra/GetApp, G2, Trustpilot, Product Hunt, katalogi branżowe UK.
3. Pitch do 10 artykułów „best barber booking software UK”.
4. Reddit (r/barber, r/UKBusiness) z ujawnieniem, kim jesteś.
5. YouTube: 3–5 krótkich nagrań ekranu (rezerwacja klienta, panel właściciela, raporty) z tym samym opisem marki. Po publikacji Claude doda je na stronę z `VideoObject`.

### Etap 4. Snippet eligibility + indeksacja (kod) ✅ `geo-aeo-4-changelog.md`

1. Jawna dyrektywa `max-snippet:-1, max-image-preview:large, max-video-preview:-1` na wszystkich indeksowanych stronach (dziś brak meta robots, więc Google stosuje domyślne limity) i test, że nigdzie na publicznych stronach nie ma `nosnippet` ani `data-nosnippet` (wyjątek: `data-nosnippet` na dwóch kontenerach widżetów demo z przykładowymi danymi).
2. Test, że każda strona z sitemap ma 200, `index`, kanoniczny adres na siebie i nie jest zablokowana w `robots.txt` dla botów AI.
3. Decyzja o `Google-Extended` i `GPTBot` (trening modeli): dziś nie są nazwane, więc są dopuszczone. Blokada nie wpływa na AI Overviews, ale wpływa na to, co modele „wiedzą” o KERSIVO bez wyszukiwania. Rekomendacja: zostawić dopuszczone.
4. Ty: GSC i Bing, sprawdzenie raportu indeksowania i ręczne zgłoszenie stron zmienionych w etapach 1–2.

### Etap 5. Entity + E-E-A-T (kod + Ty) ✅ kod: `geo-aeo-5-changelog.md`; punkt 4 (Wikidata) czeka na niezależne źródła

1. Strona „How KERSIVO Insights is written and checked” (zasady redakcyjne: źródła, data sprawdzenia, brak sponsorowanych treści, poprawki). Link z każdego artykułu i z `/about`. To E-E-A-T bez nazwiska założyciela.
2. W Article JSON-LD: `publishingPrinciples` → ta strona, `citation` → źródła z sekcji References, `dateModified` = data sprawdzenia (już jest).
3. Organization: `knowsAbout` (barbershop booking, deposits, no-shows itd.), `slogan` tylko z zatwierdzonych sformułowań (brak zatwierdzonego sloganu, więc pominięty), `sameAs` uzupełniane, gdy profile z etapu 3 będą aktywne.
4. Ty: Wikidata dopiero wtedy, gdy będą niezależne źródła o KERSIVO (bez nich wpis zostanie usunięty).

### Etap 6. llms.txt (kod, niski priorytet) ✅ `geo-aeo-6-changelog.md` (`/llms-full.txt`: odpowiedzi i FAQ z 25 stron produktu i porównań)

1. Krótkie odpowiedzi z etapu 1 w `/llms.txt` (robione razem z etapem 1).
2. Opcjonalnie `/llms-full.txt` z pełną treścią stron produktu i porównań. Mały wpływ na Google, ale tani w utrzymaniu, bo generowany z tych samych stałych.

### Etap 7. Metryki: AI visibility, citation rate, mention rate (kod + Ty)

1. Arkusz logu w repo (`docs/seo/ai-visibility-log/RRRR-MM.md`) z tabelą z playbooka i podsumowaniem: mention rate (x/40), citation rate (x/40), share of voice względem Booksy, Fresha, Treatwell w tych samych odpowiedziach.
2. Licznik wizyt botów AI: lekki log w middleware (user-agent OAI-SearchBot, PerplexityBot, Claude-SearchBot itd. → ścieżka, dzień), żeby widzieć, które strony AI faktycznie pobiera. Wymaga sprawdzenia kosztu w Vercel.
3. GA4: raport polecających z chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com (kanał już opisany w `ga4-setup.md`).
4. Ty: pierwszy test 10 promptów 1 grudnia 2026 jako punkt odniesienia przed efektami etapów 1–2.
