# Audit P2 — snippets with a hook, city pages, entities, llms.txt

Branch `seo/audit-p2`. Source: the 20-day audit of 26 November 2026 (P2-1 to P2-6) and the founder's notes on it (26 Nov): the alternative pages get the most impressions but a low CTR, so their snippets need a pain point, a hook and the price; /barbershop-website-design has the best CTR, so it can sell as well; the pages with new titles need a strong hook and the price.

Rules every snippet below follows:
- every competitor figure comes from its `*Facts.ts` module, computed rather than typed;
- every hook is something the page itself says;
- "0% KERSIVO commission" always ends with "Stripe fees apply";
- titles ≤ 60 characters, descriptions ≤ 155.

## P2-3, P2-6, P2-1: titles and descriptions

| Page | Before | After | Hook (where the page says it) |
|---|---|---|---|
| `/booksy-alternative` | T 54: Booksy Alternative UK for Barbers: Own Site, £39/Month<br>D 149: Leaving Booksy? Your own site and domain, £39/month per location, no per-barber fees, help moving clients, 0% KERSIVO commission (Stripe fees apply). | T 51: **Booksy Alternative UK: £39 Flat, No Per-Barber Fees**<br>D 151: Booksy for 3 barbers: £60/month with VAT. KERSIVO: £39/month flat, your own website, and help moving clients. 0% KERSIVO commission. Stripe fees apply. | A Booksy bill that grows with every barber. £60 is the page's own "3 users" worked example (`estimateBooksyMonthlySubscription(3)`, booksyFacts). |
| `/fresha-alternative` | T 58: Fresha Alternative UK: Keep Your Clients & Brand \| KERSIVO<br>D 149: Looking for a Fresha alternative? KERSIVO gives UK barbershops their own booking website, flat pricing and 0% KERSIVO commission (Stripe fees apply). | T 54: **Fresha Alternative UK: £39 Flat, No 20% New-Client Fee**<br>D 155: Fresha takes 20% + VAT of a new Marketplace client’s first visit. KERSIVO: your own booking site, £39/month flat. 0% KERSIVO commission. Stripe fees apply. | Fresha's Marketplace new-client fee (`marketplaceNewClientFee`, freshaFacts). |
| `/treatwell-alternative` | T 63: Treatwell Alternative UK: Your Brand, Direct Bookings \| KERSIVO<br>D 142: UK barbers: take bookings on your own branded site, not a marketplace. Flat £39/month per location, 0% KERSIVO commission (Stripe fees apply). | T 57: **Treatwell Alternative UK: No 35% New-Client Cut, £39 Flat**<br>D 152: Treatwell can take 35% + VAT of a new client’s first visit. KERSIVO: booking on your own site, £39/month flat. 0% KERSIVO commission. Stripe fees apply. | Treatwell's new-client commission (treatwellFacts). "Can take" keeps it right for shops not on Treatwell yet. |
| `/timely-alternative` | T 59: Timely Alternative UK for Barbers: Flat £39/month \| KERSIVO<br>D 156: Timely now bills weekly, by bookings. KERSIVO is £39/month per location, flat, with your own website. Compare prices, fees and switching for UK barbershops. | T 56: **Timely Alternative UK: Flat £39/mo, However Busy You Get**<br>D 152: Timely bills weekly, and the price rises with bookings. KERSIVO: £39/month per location, flat, with your own website. Enter your Timely bill to compare. | A weekly bill that rises with bookings. The page has an input for the Timely weekly bill. |
| `/nearcut-alternative` | T 55: Nearcut Alternative UK: Own Site + Booking, Flat £39/mo<br>D 154: Leaving Nearcut? A custom UK barbershop website, online booking, deposits and retail pickup for £39/month flat. 0% KERSIVO commission (Stripe fees apply). | T 56: **Nearcut Alternative UK: £39 Flat, No Client Booking Fees**<br>D 153: Nearcut’s free plan adds a booking charge your clients pay. KERSIVO: your own site and booking, £39/month flat. 0% KERSIVO commission. Stripe fees apply. | The booking charge on Nearcut's free plan, paid by clients. The page shows the figure. |
| `/vagaro-alternative` | T 59: Vagaro Alternative UK for Barbers: Flat £39/month \| KERSIVO<br>D 153: Leaving Vagaro? A custom UK barbershop website, online booking, deposits and retail pickup for £39/month flat. 0% KERSIVO commission (Stripe fees apply). | T 49: **Vagaro Alternative UK: £39 Flat, Website Included**<br>D 155: Vagaro adds £10 per extra calendar and £15/month for a MySite website. KERSIVO: site and booking, £39/month flat. 0% KERSIVO commission. Stripe fees apply. | Vagaro's per-calendar price and the MySite add-on (vagaroFacts). |
| `/square-appointments-alternative` | T 56: Square Appointments Alternative for UK Barbers \| KERSIVO<br>D 151: Looking for a Square Appointments alternative in the UK? Compare Free, Plus and Premium pricing, card fees, websites, deposits and KERSIVO for barbers. | T 56: **Square Appointments Alternative for UK Barbers: £39 Flat**<br>D 153: Square Plus is £29/month and Premium £69 per location. Full KERSIVO is £39: a barbershop website on your own domain, booking, deposits and retail pickup. | Square Plus and Premium prices (`squareBaseMonthlyPriceGbp`, squareFacts). |
| `/phorest-alternative` | T 51: Phorest Alternative UK for Barbershops: Flat £39/mo<br>D 149: Switch from Phorest to KERSIVO: built for UK barbershops … for £39/month flat. | T 49: **Phorest Alternative UK: £39 Flat, No Quote Needed**<br>D 144: Phorest is salon software priced by quote. KERSIVO is built for barbershops: £39/month per location, website and booking included, no setup fee. | Phorest has no public price (quote only). |
| `/squire-alternative` | T 50: SQUIRE Alternative UK for Barbershops: Flat £39/mo<br>D 151: SQUIRE alternative for UK barbershops: custom website on your domain, … £39/month flat. No lock-in. | T 49: **SQUIRE Alternative UK: Priced in Pounds, £39 Flat**<br>D 151: SQUIRE publishes US-dollar prices, so UK shops need a quote. KERSIVO is £39/month per location, no VAT added, with your own website. Stripe fees apply. | SQUIRE publishes USD prices only, and UK shops need a quote. |
| `/setora-alternative` | T 47: Setora Alternative for UK Barbershops \| KERSIVO<br>D 151: Looking for a Setora alternative in the UK? Compare Setora and KERSIVO pricing, … | T 49: **Setora Alternative UK: Flat £39/mo Instead of £59**<br>D 155: Setora lists £59/month per location. Full KERSIVO is £39, with your own website and domain, booking and deposits. 0% KERSIVO commission. Stripe fees apply. | Setora's per-location price (`canonicalMonthlyGbp`, setoraFacts). |
| `/barbershop-reports` (P2-6) | T 69: Barbershop Reports: Find Empty Chairs, No-Shows & Your Busiest Barber | T 57: **Barbershop Reports: Find Empty Chairs & No-Shows \| £39/mo**<br>D unchanged (153) | Within 60 characters, with the price added. |
| `/barbershop-retail-pickup` (P2-6) | T 59: Barbershop Click and Collect: £39/mo, 0% KERSIVO Commission<br>D 163: Sell pomade and beard oil on your own barbershop website. … | T 59: **Barbershop Click and Collect: No Postage or Packing, £39/mo**<br>D 155: Sell pomade and beard oil on your own website. Clients pay online or at the counter when they collect. £39/month. 0% KERSIVO commission. Stripe fees apply. | The reason owners never sold online (posting and packing). The hero says "No postage, no packing". |
| `/barbershop-online-booking` (P2-6) | D 159: Online booking for UK barbershops at £39/month per location: real free times, … | Title unchanged.<br>D 152: No app: clients book a barber and a real free time on your own site, deposit optional. £39/month per location. 0% KERSIVO commission. Stripe fees apply. | No customer app, unlike marketplaces. |
| `/barbershop-website-design` (P2-1) | T 50: Barbershop Website Design UK \| Custom Sites £39/mo<br>D 152: Custom barbershop website design for UK shops. Online booking, deposits, retail pickup shop and your own domain for £39/month. See a free preview first. | T 55: **Barbershop Website Design UK: Free Preview, Then £39/mo**<br>D 153: See your barbershop website designed before you pay: your name, photos, barbers and prices, with booking built in. Free preview, no card. Then £39/month. | The free preview, which is the page's primary CTA. Without the free-preview flow, the page falls back to the old price-led pair, so the snippet never promises a preview that is switched off (`getBarbershopWebsiteDesignSeo`). |

### P2-1: /barbershop-website-design as guide and sales page

Founder decision: keep the page as a design guide that also sells, because it earns the best CTR on the site. Each page now owns one search intent:
- `/barbershop-website-design` owns "barbershop website design" (UK).
- `/barbershop-websites` owns "what a barbershop website should include, with booking".
- The city pages own "barbershop website design {city}".

To support that split:
- Each city page links to `/barbershop-website-design` for the national term.
- `/barbershop-websites` now links to it with the anchor "barbershop website design" instead of "… design guide".
- llms.txt lists it as "Barbershop website design" and describes the guide and the service.
- Its WebPage JSON-LD `name` and `description` follow the same flag as the `<title>`.

Note for reading Search Console: until 24 Nov 2026 the page was titled "Barbershop Website Design: Layout, Branding & UX | KERSIVO", so most of the CTR seen so far was earned under that guide title. The new title keeps "Barbershop Website Design UK" first for the same query. Compare its CTR over 2–4 weeks before changing it again.

## P2-4: city pages, their own snippets and contextual links

Titles and descriptions are no longer generated from a template. Each city file sets its own `seoTitle` and `seoDescription`, written from that city's research (`src/lib/seo/cityPages/{city}.ts`). `buildCityPageTitle` and `buildCityPageDescription` now just return those fields.

Tests check that every city's:
- title starts with "Barbershop Website Design {City}: ", contains £39 and is ≤ 60 characters;
- description is 120–155 characters and ends "£39/month flat. 0% KERSIVO commission (Stripe fees apply).";
- hook differs from every other city's;
- £ figures all appear in that city's own page copy.

| City | Before | After |
|---|---|---|
| London | T 51: Barbershop Website Design London \| £39/mo \| KERSIVO<br>D 153: templated | T 56: **Barbershop Website Design London: £39 Flat, 1 Chair or 6**<br>D 155: London fades run £20–£42, so a percentage marketplace fee grows with them. Own site and booking: £39/month flat. 0% KERSIVO commission (Stripe fees apply). |
| Birmingham | T 55 / D 157: templated | T 58: **Barbershop Website Design Birmingham: £39 Flat, Own Domain**<br>D 154: On a £15 Birmingham fade, Booksy Boost’s £5 minimum takes a third. Own site, booking, deposits: £39/month flat. 0% KERSIVO commission (Stripe fees apply). |
| Bournemouth | T 56 / D 158: templated | T 57: **Barbershop Website Design Bournemouth: Own .co.uk, £39/mo**<br>D 151: Students in term, visitors in summer: let them book your real free slots on your own .co.uk. £39/month flat. 0% KERSIVO commission (Stripe fees apply). |

Where each hook comes from on the page:
- London: the hero ("one chair in Walthamstow or six in Soho") and the market notes (£20–£42; a percentage fee grows with your prices).
- Birmingham: the market notes ("on a £15 fade that minimum takes a third of the ticket").
- Bournemouth: the market notes (term-time students, summer visitors, "a booking page that shows your real free slots").

New contextual links. Before, cities had three internal links: the hub cards, the other cities and the footer.

| Page | Where | Links |
|---|---|---|
| `/barbershop-websites` | Under the online-presence check-up, outside the city cards (`BwPresence.astro`) | Running text: "Our guides to barbershop website design in London, Birmingham and Bournemouth walk through each one." |
| `/barbershop-website-design` | Under the FAQ heading, "Local guides" (`WdFaqClose.astro`, `.wd-local` in website-design.css) | "Barbershop website design in {City}" ×3. Rows are 44 px tall, with a white `:focus-visible` outline. The arrow moves only on hover-capable pointers and not under reduced motion. |
| `/barbershop-online-booking` | Under "More free tools" in the setup section | "Local guides: booking and websites in {City}" ×3 |

All three links come from `PUBLISHED_CITY_PAGES`, so a new city appears on each page automatically. `docs/seo/city-pages-playbook.md` step 4 is updated.

## P2-2: one consistent entity graph

- `#software` keeps the url `https://kersivo.co.uk/` on every page: the city pages no longer override it. The city WebPage still points at it through `about`.
- Insights `Article.author` (the shared `#organization`) now uses `url` `https://kersivo.co.uk/`, the same url the Organization node has everywhere, instead of `/about`.
- The Organization node now links to /about through `mainEntityOfPage: { "@id": "https://kersivo.co.uk/about#webpage" }`, the AboutPage whose `mainEntity` is the Organization.

## P2-5: llms.txt and llms-full.txt

`/llms.txt` gains:
- the home page;
- `/free-preview`, only while the free-preview flow is on, like the sitemap;
- `/kersivo-vs-booksy`;
- a "Local guides" section with every published city: its hub summary, what the page covers and the research date;
- the `/insights` hub and the six category archives.

The design page is now labelled "Barbershop website design".

`/llms-full.txt` gains a "Local guides" section. For each city it copies, word for word as rendered, the hero lead, the market notes and the city FAQ. `/kersivo-vs-booksy` was already included, with its hero lead; it has no FAQ.

## Sitemap lastmod

`CONTENT_CHANGED_ISO` (26 Nov) moves the sitemap lastmod for pages whose visible date stays the same:
- the six alternatives with new snippets: Booksy, Fresha, Treatwell, Timely, Square, Setora;
- `/barbershop-reports`;
- the three city pages.

Pages without a visible date have their own constant moved instead: `/barbershop-websites` and `/barbershop-website-design` are now dated 26 Nov.

Visible dates and WebPage `dateModified` are unchanged.

## Reindexing (founder actions, after the PR is live)

IndexNow submits every URL above automatically on the first 06:40 UTC run after the merge (lastmod 26 Nov, three-day window, so merge by 29 Nov). For Google:

1. Search Console: resubmit `https://kersivo.co.uk/sitemap.xml`.
2. URL Inspection → Request indexing, highest impressions first:
   - `/booksy-alternative`, `/fresha-alternative`, `/treatwell-alternative`, `/square-appointments-alternative`, `/timely-alternative`, `/setora-alternative`, `/vagaro-alternative`, `/nearcut-alternative`, `/phorest-alternative`, `/squire-alternative`;
   - `/barbershop-website-design`, `/barbershop-websites/london`, `/barbershop-websites/birmingham`, `/barbershop-websites/bournemouth`;
   - `/barbershop-reports`, `/barbershop-retail-pickup`, `/barbershop-online-booking`, `/barbershop-websites`.
3. In 2–4 weeks, compare CTR per page in Search Console (Performance → Pages, last 28 days against the 28 days before). The alternatives and the design page are the ones to watch.

## Checks and screenshots

- `npm run claims:check`: pass.
- `npm run typecheck`: 0 errors.
- `npm test`: 7309 of 7310 passed. The one failure was the known-flaky `financialEndpoints` MANAGER 403 case, which passes when its file is run alone.
- Build: passed. `prisma generate` hit the known EPERM lock from the local dev server; the schema is unchanged, so the remaining build steps were run by hand and `astro build` completed.
- Overflow: no horizontal overflow at 375 or 1440 px on any page shot.

Screenshots are in `C:/tmp/kersivo-shots/audit-p2/`:
- full pages before and after, at 375 and 1440 px: `before-*` and `after-*` for `/barbershop-websites`, `/barbershop-website-design`, `/barbershop-online-booking` and the three city pages;
- crops of the new links: `after-detail-websites-local-*`, `after-detail-websites-design-link-*`, `after-detail-design-local-*`, `after-detail-booking-local-*`;
- the keyboard focus state: `after-detail-design-local-focus-1440.png`.
