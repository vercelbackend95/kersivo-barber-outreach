# Audyt SEO i widoczności KERSIVO: kierunki wzrostu

Data: 15 listopada 2026. Zakres: kod repozytorium (gałąź `seo/ai-visibility`), produkcja kersivo.co.uk (sitemap, robots, `llms.txt`, nagłówki, JSON-LD), wyniki wyszukiwania (wyszukiwarka z USA, więc wyniki UK mogą się nieco różnić) i istniejące dokumenty: `ROADMAP.md`, `ai-visibility-playbook.md`, `content-plan-buying-searches.md`.

---

## 1. Diagnoza w trzech zdaniach

1. **Strona jest technicznie i treściowo zrobiona lepiej niż u większości konkurentów.** Batche 1–7 zamknęły prawie wszystko, co da się poprawić w kodzie: szybkość, schema, kanoniczne adresy, roboty AI, `llms.txt`, IndexNow, strony porównawcze, kalkulatory.
2. **Wąskim gardłem nie jest już strona, tylko brak KERSIVO poza nią.** Wyszukanie „kersivo barber booking” nie zwraca ani jednego wyniku o KERSIVO. W listach „best barber booking software UK” (Capterra UK, lokalne gazety, Zenoti, Jotform, krowdbase, whito) KERSIVO nie występuje. Fraza „kersivo” miała 16 wyświetleń w GSC w miesiąc. Google i modele AI nie polecają marki, o której nikt poza nią samą nie pisze.
3. **Ruch z treści przychodzi głównie od osób, które nie kupią** (zarobki barberów, wynagrodzenia, dermatitis), a strony sprzedażowe mają mało wyświetleń (`/pricing` 43, `/starter` 23, `/barbershop-websites` 133 na pozycji ~15).

Wniosek: kolejne 3–6 miesięcy powinny iść w proporcji mniej więcej **60% poza stroną (encja, listingi, wzmianki, pętla „Powered by”), 30% treści pod decyzję zakupową, 10% techniki.** Do tej pory było odwrotnie.

---

## 2. Co jest już dobrze (nie ruszać, tylko utrzymywać)

| Obszar | Stan |
|---|---|
| Wydajność | Lighthouse `/` mobile 96, desktop 100; HTML strony głównej ~180 KB, odpowiedź < 0,25 s |
| Indeksowanie | 54 adresy w sitemap, poprawne `lastmod` z `pageDates.ts`, demo i booking mają `noindex` |
| Schema | Organization, WebSite, WebPage, SoftwareApplication z Offer, FAQPage w jednym `@graph`; Article i BreadcrumbList w Insights |
| AI | `robots.txt` wpuszcza OAI-SearchBot, ChatGPT-User, Claude-SearchBot/User, PerplexityBot; `/llms.txt`; bloki „In short” na `/compare` i 10 stronach alternatyw; IndexNow codziennie |
| Intencja kupującego | `/compare` jest na pozycji ~2,5 dla „best barber software uk”, 10 stron „[konkurent] alternative” ze źródłami i datami |
| Zasoby linkowalne | 3 kalkulatory i szablon polityki anulacji |
| Wiarygodność | Brak wymyślonych liczb i opinii, ceny konkurencji w `*Facts.ts` z datą sprawdzenia. To przewaga w AI, bo modele coraz częściej odrzucają treści bez źródeł |

---

## 3. Najważniejsze kierunki, od największego wpływu

### Kierunek 1. Zbudować encję KERSIVO poza stroną (najwyższy priorytet)

**Problem:** ChatGPT (przez indeks Bing), Perplexity, Gemini i AI Overviews budują odpowiedź „best barber booking software UK” z kilku stron trzecich: katalogów (Capterra/GetApp), list rankingowych i Reddita. Dziś KERSIVO nie ma żadnej z nich, więc AI czyta Twoje strony (GSC pokazuje pytania czatowe na pozycjach 3–6), ale nie wymienia marki.

**Co zrobić (kolejność ma znaczenie):**

1. **Bing Webmaster Tools + sitemap + IndexNow** (instrukcja jest w `ai-visibility-playbook.md`, sekcja 2). To 20 minut i bezpośrednio wpływa na ChatGPT i Copilota.
2. **Capterra UK → GetApp UK → Software Advice** (jeden formularz u Gartnera). Strona katalogu Capterra UK „barbershop software” jest w top 10 dla głównej frazy, więc to jednocześnie link, ruch i źródło dla AI.
3. **G2, Trustpilot, Product Hunt**, potem katalogi z listy niżej.
4. **Pierwsze prawdziwe opinie** od obecnych klientów na Capterra/Trustpilot (bez zachęt za ocenę). Nawet 5–10 opinii zmienia to, jak AI opisuje markę.
5. Po każdym aktywnym profilu dopisać URL do `KERSIVO_OFF_SITE_PROFILES` w `src/lib/seo/kersivoEntityJsonLd.ts` (trafia do `sameAs`).
6. Zamienić Facebook `profile.php?id=…` na adres typu facebook.com/kersivo.

**Nowe cele do pitchu**, których nie ma jeszcze w playbooku (wszystkie znalezione dziś w wynikach dla „best barber booking software UK 2026”; przed kontaktem sprawdzić autora i czy to treść sponsorowana):

- [krowdbase.com: Best Barbershop Software in UK](https://www.krowdbase.com/best-barbershop-software-uk), katalog z formularzem dla dostawców
- [whito.co.uk: best booking systems for hairdressers and barbers UK](https://whito.co.uk/hairdressers/tools/best-booking-systems-hairdressers-barbers-uk/)
- [addagio.io: best barber booking software](https://addagio.io/best/best-barber-booking-software)
- [Jotform: 5 best barbershop booking software](https://www.jotform.com/blog/barbershop-booking-software/)
- [NHBF: building a website for your salon or barbershop](https://nhbf.co.uk/news-and-blogs/blog/building-a-website-for-your-salon-or-barbershop), artykuł branżowej federacji; propozycja to członkostwo dostawcy albo gościnny tekst ekspercki, nie prośba o link

**Miernik:** liczba domen, które piszą o KERSIVO (cel na 90 dni: 15+), wyświetlenia frazy „kersivo” w GSC, wynik miesięcznego testu 10 promptów (cel: wzmianka w ≥ 8/40 odpowiedzi po 3 miesiącach).

### Kierunek 2. Pętla wzrostu „Powered by KERSIVO” (największa niewykorzystana dźwignia w kodzie)

Każdy klient Full ma własną stronę i własny booking. To są jedyne strony w internecie, które w naturalny sposób mówią „ten barber korzysta z KERSIVO”, a ich klienci (ci, którzy umawiają wizyty) obejmują też innych barberów i właścicieli salonów.

Stan dziś:
- Strony klientów mają „subtelny znak Powered by KERSIVO” (tak mówi `FullOffer.astro` i FAQ), ale trzeba sprawdzić, czy to **klikalny link** do kersivo.co.uk.
- Strona bookingu `/book/[shopId]` **nie ma żadnego odnośnika do KERSIVO** (sprawdzone w kodzie). Sklep (`StorefrontShopPage.tsx`) ma.

Do zrobienia:
1. Na stronach klientów, w bookingu, na ekranie potwierdzenia i w stopce maili/SMS z potwierdzeniem: „Bookings by KERSIVO” → `https://kersivo.co.uk/?utm_source=powered-by&utm_medium=referral&utm_campaign={shopSlug}`.
2. Anchor zawsze **tylko nazwa marki**, nigdy fraza typu „barber booking software” (Google traktuje linki z widgetów z frazami jako manipulację). Bezpieczna opcja: `rel="nofollow"` na booking i potwierdzeniach, zwykły link w stopce strony klienta. Wartość pętli to ruch polecający i wzmianki marki, a nie siła linku.
3. Strona docelowa dla tego ruchu: krótka sekcja na `/` albo osobny landing „Your barber uses KERSIVO. Run a shop? See what it costs.” z CTA „Get my free preview”.
4. GA4: kanał „powered-by”, żeby było widać, ile podglądów przychodzi z sieci klientów.

To skaluje się z każdym klientem bez dodatkowej pracy.

### Kierunek 3. Treści pod decyzję zakupową zamiast ruchu „dla każdego”

Plan 14 tekstów w `content-plan-buying-searches.md` jest dobry; trzeba go po prostu wykonać, zaczynając od P1 (opłaty Booksy, jak odejść z Booksy, opłaty Fresha, strona własna vs marketplace, depozyty według systemu). Dodatkowo proponuję cztery rzeczy, których plan nie obejmuje:

1. **„UK Barber Booking Fees Report 2027”**, raport z danymi. Macie w `src/lib/seo/*Facts.ts` zweryfikowane, datowane ceny 11 systemów. Złożenie ich w jeden raport (koszt miesięczny dla salonu na 1, 3, 6 foteli, prowizje za nowego klienta, opłaty kartowe) daje:
   - materiał do PR dla prasy branżowej i lokalnej (jedyny sposób na zdobycie mocnych linków bez płacenia),
   - źródło, które AI chętnie cytuje, bo ma liczby, daty i metodologię,
   - powód do aktualizacji co kwartał (nowa data → IndexNow → świeżość).
   Bez szacunków i ankiet, wyłącznie publiczne cenniki, z zastrzeżeniem, że to nie jest niezależny ranking.
2. **Neutralne strony „X vs Y” między konkurentami**: „Booksy vs Fresha for UK barbershops”, „Fresha vs Treatwell”. To frazy o dużym wolumenie, w których KERSIVO może być uczciwym trzecim wyborem. FAQ „Booksy or Fresha?” już jest na `/compare`; osobna strona wyłapie więcej zapytań i będzie częściej cytowana przez AI.
3. **Więcej darmowych narzędzi i szablonów** (najlepiej pozyskują linki i udostępnienia): cennik usług do wydruku/PDF, szablon umowy wynajmu fotela (chair rental agreement; konieczna weryfikacja prawna albo wyraźne zastrzeżenie), grafik zmian dla barberów, formularz zgody na zabiegi (skin fade, golenie brzytwą). Każde z nich jest powodem, żeby blog barberski, akademia czy księgowy podlinkował KERSIVO.
4. **Odchudzić mapę Insights**: artykuły dla pracowników („barber pay”, „commission minimum wage”) zostawić, ale nie pisać kolejnych w tym kierunku. Każdy nowy tekst musi mieć właściciela salonu jako czytelnika.

### Kierunek 4. YouTube i wideo (kanał, którego dziś nie ma)

Google AI Overviews i Gemini bardzo często cytują YouTube, a właściciele salonów szukają tam „how to set up online booking”, „Booksy vs Fresha”. Wystarczy prosty format: nagrany ekran plus głos, 3–6 minut, bez twarzy (zgodnie z zasadą „bez założyciela”):

- „How a client books at a KERSIVO barbershop” (demo `/book` i `/demo`)
- „Setting deposits to stop no-shows” (wsparcie dla kalkulatora no-show)
- „What Booksy actually costs a 4-chair shop in 2026” (z danych z raportu)
- „Moving off a marketplace without losing clients”

Każde wideo z opisem z sekcji 1 playbooka i linkiem do strony, która „posiada” daną frazę. Na stronie osadzić je z `VideoObject` w JSON-LD. Te same klipy pocięte na 30–60 s idą na TikTok i Instagram, które już macie.

### Kierunek 5. Google Business Profile i Reserve with Google (produkt jako kanał SEO)

- **Krótko:** artykuł o linku do bookingu w Google Business Profile już jest. Zrobić z niego **obowiązkowy krok onboardingu**: każdy klient Full ma ustawiony link „Book” w swoim profilu Google na booking KERSIVO. To działa na korzyść klienta (więcej rezerwacji z Map) i wzmacnia argument sprzedażowy.
- **Długoterminowo:** integracja jako partner Google **Reserve with Google / Actions Center** (przycisk „Book” bezpośrednio w Mapach). Booksy i Fresha to mają; dla małego dostawcy próg wejścia jest wysoki, ale warto sprawdzić wymagania programu i wpisać to do roadmapy produktu. Byłby to najmocniejszy argument w porównaniach z marketplace’ami.

### Kierunek 6. Kanały płatne i bezpośrednie (żeby nie czekać tylko na SEO)

SEO dla nowej marki w niszowej kategorii to 6–12 miesięcy. Warto równolegle uruchomić:

1. **Google Ads na frazy zmiany systemu i zakupowe**: „booksy alternative”, „fresha alternative uk”, „barber booking software uk”, „barbershop website”. Wolumen mały, intencja bardzo wysoka; strony docelowe już istnieją. Budżet testowy 10–15 £ dziennie przez 4 tygodnie, mierzyć koszt pozyskania podglądu (`free_preview` submit).
2. **Microsoft Ads**: te same frazy, zwykle tańsze kliknięcia, a przy okazji zasila to ekosystem Bing.
3. **Meta (Facebook/Instagram)** kierowane na właścicieli małych firm z zainteresowaniem barbering, z ofertą „see your shop’s website free”. Darmowy podgląd to świetny hak reklamowy, bo nic nie kosztuje odbiorcy.
4. **Partnerstwa**: akademie barberskie (ich absolwenci otwierają salony), księgowi specjalizujący się w branży beauty, hurtownie barberskie, organizatorzy targów branżowych w UK. Prosty program polecający (np. miesiąc gratis dla polecającego) **zmienia warunki handlowe, więc wymaga Twojej decyzji** i wpisu w `claimsPolicy.ts`.
5. **Reddit / fora**: zasady są w playbooku (sekcja 5). Regularność ważniejsza niż ilość: 2–3 pomocne odpowiedzi tygodniowo.

### Kierunek 7. Social proof i case studies (blokuje konwersję i AI)

Strona nie ma żadnych realnych przykładów klientów, co jest uczciwe, ale osłabia i konwersję, i rekomendacje AI. Gdy tylko pierwsi klienci Full będą zadowoleni:

- za zgodą klienta: **portfolio prawdziwych stron** (`/work` dziś zwraca 404, więc to naturalne miejsce) ze zrzutem, miastem i linkiem do żywej strony,
- krótkie case study z **faktami, nie obietnicami** (co było wcześniej, ile foteli, jaki plan, co się zmieniło w procesie),
- dopiero wtedy `Review` w schema, i wyłącznie z prawdziwych opinii.

Nic z tego nie może być wymyślone ani „przykładowe” (zgodnie z `claimsPolicy.ts`).

---

## 4. Drobne rzeczy techniczne i on-page

| # | Problem | Gdzie | Priorytet |
|---|---|---|---|
| 1 | Booking `/book/[shopId]` bez linku „by KERSIVO” | `src/pages/book/[shopId].astro` | Wysoki (kierunek 2) |
| 2 | `sameAs` ma tylko 3 profile społecznościowe, Facebook jako `profile.php?id=` | `kersivoEntityJsonLd.ts`, `footerSocialLinks.ts` | Wysoki, po założeniu profili |
| 3 | Tytuł `/shop` „Retail Demo \| Kersivo”: zła wielkość liter marki (strona ma `noindex`, więc tylko porządek) | szablon sklepu | Niski |
| 4 | Stary obraz OG (pozostałość z roadmapy, bez „ZERO COMMISSION”) | `public/` | Średni, bo wpływa na CTR w social i w czatach z podglądem linku |
| 5 | Roboty treningowe (GPTBot, Google-Extended, Applebot-Extended, CCBot) są wpuszczone tylko przez `User-agent: *`. Rekomendacja: zostawić dostęp (obecność w danych treningowych pomaga marce), ale dopisać je jawnie, żeby decyzja była widoczna i testowana | `src/pages/robots.txt.ts` | Niski |
| 6 | Brak `VideoObject` (do zrobienia razem z kierunkiem 4) | layout stron | Średni |
| 7 | Brak strony „KERSIVO vs Booksy” w formie tabeli 1:1 (jest „Booksy alternative”); dla zapytania 10 z testu AI („KERSIVO vs Booksy”) warto mieć sekcję z kotwicą `#kersivo-vs-booksy` na stronie alternatywy, bez nowego URL | `booksyAlternativeContent.ts` | Średni |
| 8 | Prośba o indeksację `/`, `/pricing`, `/barbershop-websites` w GSC (zaległe zadanie z roadmapy) | GSC | Wysoki, 5 minut |

---

## 5. Plan na 90 dni

**Tydzień 1–2 (Ty, poza kodem, ~4 h):** Bing Webmaster Tools, prośby o indeksację w GSC, Capterra/GetApp, G2, Trustpilot, bio w social z playbooka, adres FB.

**Tydzień 1–3 (kod, Claude):** pętla „Powered by” (booking, potwierdzenia, maile, UTM, landing), sekcje P1 z planu treści (opłaty Booksy/Fresha, jak odejść z Booksy), `sameAs` po założeniu profili.

**Tydzień 3–6:** raport „UK Barber Booking Fees 2027” + wysyłka do 10–15 mediów i list (prasa branżowa, lokalne listy z playbooka, nowe cele z kierunku 1). Strona „Booksy vs Fresha”. Pierwsze 2 wideo na YouTube. Test Google Ads + Microsoft Ads.

**Tydzień 6–12:** pozostałe teksty P1/P2, 2 nowe narzędzia/szablony, kolejne wideo, prośby o opinie u pierwszych klientów, portfolio `/work` (gdy będą zgody), comiesięczny test 10 promptów AI.

---

## 6. Co mierzyć co miesiąc

| Miernik | Skąd | Dziś | Cel za 90 dni |
|---|---|---|---|
| Wyświetlenia frazy „kersivo” | GSC | ~16/mies. | 150+ |
| Domeny wspominające KERSIVO | GSC → Linki / Bing WMT | ~0 poza własnymi profilami | 15+ |
| Wzmianki w teście 10 promptów × 4 AI | Arkusz z playbooka | prawdopodobnie 0/40 | ≥ 8/40 |
| Wyświetlenia stron sprzedażowych (`/pricing`, `/barbershop-websites`, `/starter`, `/free-preview`) | GSC | ~250/mies. łącznie | ×3 |
| Zgłoszenia free preview według kanału (organic, AI, powered-by, paid) | GA4 | brak podziału na powered-by i AI | podział działa, każdy kanał ma liczbę |
| Ruch z chatgpt.com, perplexity.ai, gemini, copilot | GA4, grupa kanałów „AI assistants” | do sprawdzenia | trend rosnący |

---

## 7. Otwarte pytania do Ciebie

1. Czy znak „Powered by KERSIVO” na stronach klientów jest już klikalnym linkiem i czy klienci go zaakceptują na bookingu i w mailach? (Kierunek 2.)
2. Czy chcesz program poleceń? Zmienia warunki handlowe, więc to Twoja decyzja.
3. Budżet testowy na reklamy płatne: zgoda na ok. 300–450 £ na 4 tygodnie?
4. Czy są już klienci, którzy zgodziliby się na portfolio, case study albo opinię?
5. Raport opłat: czy publikujemy go jako stronę w Insights, czy jako osobny adres (np. `/barber-booking-fees-uk`)? Rekomenduję osobny adres, bo będzie aktualizowany co kwartał i to jego będą linkować media.
