# City pages playbook — `/barbershop-websites/{city}`

First city: London (`src/lib/seo/cityPages/london.ts`, research checked 24 November 2026).
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
4. **Check the title length.** `buildCityPageTitle` switches to "Barbershop Websites {City} | £39/mo | KERSIVO"
   when the full form passes 60 characters. The description must stay within 145–158 characters (tested).
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
