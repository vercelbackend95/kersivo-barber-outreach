# City pages playbook — `/barbershop-websites/{city}`

Published: London (`src/lib/seo/cityPages/london.ts`), Birmingham (`src/lib/seo/cityPages/birmingham.ts`) and
Bournemouth (`src/lib/seo/cityPages/bournemouth.ts`), all researched and checked 24 November 2026.
This is the workflow for adding the next city. A city ships only with its own research file; there is no
way to publish a city by name alone, so we never end up with thin, name-swapped pages.

## How it is built

| Piece | File | City-specific? |
|---|---|---|
| Research data (prices, chair rent, areas, costs, journey, FAQ, sources) | `src/lib/seo/cityPages/<city>.ts` | yes, all of it |
| Data model | `src/lib/seo/cityPages/types.ts` | no |
| Registry, title/description, breadcrumbs, JSON-LD | `src/lib/seo/cityPages/index.ts` | no |
| Calculator maths (reads Booksy/Fresha/Treatwell `*Facts.ts`) | `src/lib/cityPages/marketplaceMath.ts` | no |
| Browser behaviour (calculator, tabs) | `src/lib/cityPages/initCityPage.ts` | no |
| Route (404 for unknown cities) | `src/pages/barbershop-websites/[city].astro` | no |
| Sections | `src/components/cityWebsite/Cw*.astro` | no (render the data) |
| Styles | `src/styles/city-website/page.css` | no |
| Hub link band | `src/components/barbershopWebsite/BwLocalGuides.astro` | no (lists the registry) |
| Sitemap + lastmod | `marketingSitemap.ts`, `pageDates.ts` (from the registry, lastmod = `checkedIso`) | no |
| Tests | `src/lib/seo/cityPages.test.ts` (runs over every published city) | mostly no |

## Adding a city

1. **Research first, copy second.** Fill every field of `CityPage` from sources you have read, and list each
   source with the date you read it (`checkedIso`) and the page's own date (`pageDate`) if it shows one.
   - Prices: published price lists or a price survey that says how it was gathered. Show ranges with the
     source named; never present a third-party survey as our own data. The calculator default price is the
     survey's typical independent skin fade (`calculator.priceNote` says so).
   - Chair rent: a dated sample of adverts or a published range; say whose estimate it is.
   - Nation rules: business rates (England: GOV.UK multipliers notice; Scotland: non-domestic rates and
     the Small Business Bonus Scheme; Wales: non-domestic rates relief), Making Tax Digital (UK-wide,
     GOV.UK), card fees from `stripeFacts.ts`. General information, never advice; point to the council/HMRC.
   - Areas: real districts. Write `pattern` as plain observation ("shops here often…") and `setup` as what
     we would configure. No footfall numbers, rankings, counts or invented local stats.
   - Journey: a real district and street (no house numbers); the shop is the fictional Heritage Grooming
     demo, labelled as fictional on the page. Never use a name that could be a real local shop.
   - FAQ: 4–5 questions that name the city. Deposits: the payment mode is per shop
     (`ShopSettings.bookingPaymentMode`), not per slot; say so.
2. **Check every claim against the house rules** (`CLAUDE.md`, `src/lib/pricing/claimsPolicy.ts`):
   £39/month per location, not per barber; "0% KERSIVO commission" always with "Stripe fees apply" nearby;
   setup "a few days"; SMS "within a monthly allowance"; Starter secondary. Competitor figures only from
   `*Facts.ts` (re-verify if older than 90 days; the test enforces 90 days against the city's check date).
3. **Register it:** add the export to `PUBLISHED_CITY_PAGES` in `src/lib/seo/cityPages/index.ts`. The route,
   sitemap, lastmod and hub band follow. Add the URL to `EXPECTED_LOCS` in `marketingSitemap.test.ts`.
4. **Write the search snippet from the research** (audit P2-4: templated titles read as doorway pages). Set
   `seoTitle` and `seoDescription` in the city file; `buildCityPageTitle` / `buildCityPageDescription` only return them.
   - Title: "Barbershop Website Design {City}: " first, then a hook from this city's page and the flat price,
     at most 60 characters (e.g. London "£39 Flat, 1 Chair or 6", from the hero).
   - Description: one local pain point from the market notes (a price band, a marketplace minimum on a cheap
     cut, a seasonal pattern), then "£39/month flat. 0% KERSIVO commission (Stripe fees apply)." at the end,
     120–155 characters. Every £ figure must appear in the city's own copy, and the opening hook must differ
     from every other city's (all tested).
   `cityPages.test.ts` also fails if any sentence of city copy (outside approved policy wording) is shared by two
   cities, so a new city cannot be a reworded copy of an existing one.
   The city then appears automatically in the contextual links on `/barbershop-websites` (check-up section),
   `/barbershop-website-design` (local guides under the FAQ), `/barbershop-online-booking` (setup section),
   `/llms.txt` and `/llms-full.txt`. Add the city path to `CONTENT_CHANGED_ISO` only when its snippet changes
   after launch.
5. **Verify:** `npm run claims:check`, `npm test`, `npm run typecheck`, `npm run build`; screenshots at 375,
   768, 1024 and 1440 with no horizontal scroll; calculator and tabs work by keyboard; reduced motion.

## Target queries (London)

`barbershop website design London`, `barber website London`, `barbershop booking system London`,
`barber website with online booking London`. Search volumes were not checked (no keyword tool connected);
the targeting follows the query pattern, title and H1. Confirm volumes in Search Console after launch.

## London sources (checked 24 November 2026)

- The Barber Board, "How much should a haircut cost in the UK?" (updated 1 Nov 2026) — London price ranges.
- TrimCheck, chair rental guide — London chair rent ranges (sample of adverts, 23 Sept 2026).
- GOV.UK, 2026/27 non-domestic rating multipliers notice (10 Feb 2026); GOV.UK small business rate relief.
- RBKC, business rate changes from 1 April 2026 (updated 6 Jul 2026) — RHL multiplier conditions.
- GOV.UK, MTD for Income Tax press release (5 Oct 2026) — £30,000 from 6 April 2027, £20,000 from April 2028.
- Google Business Profile Help: local ranking (relevance, distance, prominence; no paid ranking) and local
  business links (owner-added booking links).
- Competitor fees: `booksyFacts.ts`, `freshaFacts.ts` (15 Nov 2026), `treatwellFacts.ts` (8 Oct 2026).
  SQUIRE is not priced: its public prices are USD and no UK quote is verified (`squireFacts.ts`).

## Bournemouth sources (checked 24 November 2026)

- Booksy, "Skin Fade in Bournemouth" search (32 results; our read of the 15 barbershops on page 1 with a
  stand-alone fade, list prices, mobile barbers left out): £16–£30, middle price £20 (calculator default).
- Booksy, "Barber Shop in Bournemouth" search: men's haircut £13–£23 (5 shops with a plain haircut price).
- The Barber Board guide: UK town (£15–£27, typical £19) and big-city (£16–£30, typical £22) fades, for comparison.
- No published Bournemouth chair-rent survey exists. Two UK Therapy Rooms town-centre adverts (BH1 £150/week,
  BH2 £50/day) were read in the browser; both say they no longer accept enquiries, and the page says so.
  TrimCheck for the common 60/40 split outside London.
- BCP Council, "Important changes to business rates in 2026" (no page date): multipliers, council decides
  eligibility, SBRR kept for 3 years after taking a second property.
- HM Treasury, "Business Rates Multipliers: Qualifying Retail, Hospitality or Leisure" (updated 30 Mar 2026):
  lists hair and beauty salons, including hairdressers; appointment-only premises still count.
- Shared with London (read the same day): GOV.UK multipliers notice, SBRR, MTD press release, Google Business
  Profile Help pages, Stripe UK pricing (`stripeFacts.ts`).
- Not usable: Treatwell's Bournemouth listing pages returned empty responses; Fresha's Bournemouth page showed
  no shop prices. Search volumes not checked (no keyword tool connected).

## Birmingham sources (checked 24 November 2026)

- Booksy, "Skin Fade in Birmingham" search (45 results; our read of the 15 barbershops on page 1 with a stand-alone
  adult fade, list prices, full fade used where a back-and-sides-only price is also listed, kids' and student prices
  left out): £15–£38, middle price £25 (calculator default). B1–B5 (7 shops) £23–£38; outside B1–B5 (8 shops,
  Bradford Street in Digbeth to Kings Heath and Acocks Green) £15–£25.
- The Barber Board guide: UK big-city fade band (£16–£30, typical £22), for comparison.
- TrimCheck chair-rental guide: Manchester/Birmingham/Leeds/Glasgow band, £90–£150 a week, £20–£35 a day, 60/40
  split (adverts sampled 23 Sept 2026). No Birmingham chair advert with a readable price was found: the Hockley
  "£300 a week" advert in search results had been taken down, and Gumtree cannot be opened in our browser.
- Birmingham City Council, "How we work out your business rates" (updated 21 Nov 2025): the five 2026/27 multipliers.
- Birmingham City Council, "Reductions for small businesses" (updated 6 Mar 2026): SBRR £12,000 / taper to £14,999,
  apply online; 2026 supporting small business relief caps bill rises at £800 a year to 2028/29, automatic.
- Shared with London and Bournemouth (read the same day): HM Treasury qualifying-use guidance, GOV.UK multipliers
  notice, MTD press release, Google Business Profile Help pages, Stripe UK pricing (`stripeFacts.ts`).
- The walkthrough is set on Alcester Road in Moseley; its service (skin fade + beard trim) shows a fictional £32 via `journey.servicePrice`; the calculator
  keeps the £25 fade. Search volumes not checked (no keyword tool connected).
