# Content plan — searches that lead to buying

Branch `seo/owner-intent-bridges`. Written 14 November 2026 from Search Console data for 15 October – 11 November 2026 (supplied by the founder; not re-pulled here).

## Why this plan exists

Insights pulls impressions, but mostly from people who will never buy shop software:

| Page | Impressions | Clicks | Who searches |
| --- | ---: | ---: | --- |
| /insights/how-much-do-barbershop-owners-make-uk | 1,489 | 7 | Mixed: "how much do barbers make", "barber wage", "self employed barber salary uk" |
| /insights/barbershop-walk-ins-vs-appointments | 1,043 | — | Mostly owners |
| /insights/apprentice-barber-funding-costs-2026 | 553 | — | Owners and apprentices |
| /insights/barber-dermatitis-skin-care-hse | 553 | — | Barbers and owners |
| /insights/barbershop-business-rates-2026-england | 470 | — | Owners |
| /insights/barber-commission-pay-minimum-wage-uk | 403 | — | Mostly employed barbers ("barber pay") |
| /insights/barbershop-no-show-cost-when-deposit-makes-sense | 398 | — | Owners |

The commercial pages hardly appear: /pricing 43, /starter 23, /free-preview 54 (position 35), /barbershop-websites 133 (position 15).

Where we already show up for buying searches:

| Search | Position | Page that should own it |
| --- | ---: | --- |
| best barber software uk | 2.5 | `/compare` |
| what booking system do uk barbers use | 5.9 | `/compare` |
| barber appointment software uk | 9.2 | `/` (home) |
| barber software uk | 10 | `/` (home) |
| appointment software for barbers uk | 11.6 | `/` (home) |

Part A of this branch (code) adds owner bridges to the seven Insights articles above. This document is Part B: the next 14 pieces, each aimed at a shop owner close to choosing or changing a booking system.

## Rules for every piece

- British English, £. Full KERSIVO (£39/month per location) is the main offer; Starter (£0) is a secondary option, never the main CTA (except on `/starter`). Main CTA: "Get my free preview".
- Competitor numbers only from `src/lib/seo/*Facts.ts`, rendered with that file's checked date. If a fact is not `verified` there, it is not published. Re-check any fact older than 60 days before the piece ships, and update the facts file first.
- KERSIVO wording only from `src/lib/pricing/claimsPolicy.ts`. "0% KERSIVO commission" always with "Stripe fees apply" nearby. Setup time: "a few days". SMS: "within a monthly allowance".
- No invented reviews, customer counts, switching stories or outcomes ("shops that switched saw…").
- Insights articles keep the Batch 5 budget: at most 3 commercial links (body + related tools/guides + end box), no product links in articles that are not about buying.
- One search, one owner page. A supporting piece links to the owner page with the search phrase (or close to it) as the anchor and does not target the same title.

## Search ownership map

Pages that already exist and the searches they own. New pieces below must not compete with these.

| Owner page | Searches it owns |
| --- | --- |
| `/` (home) | barber software uk, barber booking system uk, barber appointment software uk, appointment software for barbers uk |
| `/compare` | best barber software uk, what booking system do uk barbers use, barber software comparison, booking platform fees compared |
| `/booksy-alternative` | booksy alternative, leave booksy, booksy vs kersivo |
| `/fresha-alternative` | fresha alternative uk, leave fresha |
| `/treatwell-alternative`, `/timely-alternative`, `/square-appointments-alternative`, `/vagaro-alternative`, `/phorest-alternative`, `/squire-alternative`, `/setora-alternative`, `/nearcut-alternative` | "[brand] alternative" for each |
| `/barber-software-cost-calculator` | barber booking software cost, barber software price uk |
| `/barbershop-no-show-calculator` | barbershop no-show cost calculator |
| `/barbershop-cancellation-policy-template` | barbershop cancellation policy template |
| `/barbershop-online-booking` | barbershop online booking, online booking for barbers |
| `/barbershop-websites` | barbershop website, barber website uk |
| `/barbershop-website-design` | barbershop website design |
| `/starter` | free barber booking system uk |
| `/pricing` | kersivo pricing (brand) |
| `/free-preview` | free barbershop website preview (brand-adjacent) |

## The plan (14 pieces)

Priority: **P1** = close to a page we already rank for, or a direct competitor-switch search; **P2** = buying research one step earlier; **P3** = useful but slower.

### 1. Booksy fees 2026 for UK barbershops — P1

- **Target search:** booksy fees uk / booksy pricing 2026 / how much does booksy cost a barbershop
- **Format:** new section on `/booksy-alternative` ("What Booksy costs a UK barbershop in 2026"), not a new URL. The alternative page already owns the brand cluster; a separate fees article would split it.
- **Owner page:** `/booksy-alternative`
- **Internal links in:** home "Compare" block, `/compare` Booksy row, `/barber-software-cost-calculator` (Booksy preset), the card-fees and no-show Insights end boxes (only if they stay within the 3-link budget).
- **Links out:** `/barber-software-cost-calculator` (preset), `/free-preview`.
- **Source facts:** `BOOKSY_UK_COMMERCIAL_FACTS.baseSubscription`, `.additionalUser`, `.standardMarketplaceBooking`, `.boostMonthlyFee`, `.boostNewClientFee`, `.mobilePayments`, `.tapToPay` — checked 2 October 2026 (`BOOKSY_FACTS_CHECKED_DATE`). Re-check before shipping (over 40 days old by mid-November).

### 2. How to leave Booksy without losing clients — P1

- **Target search:** how to leave booksy / cancel booksy keep clients / move from booksy
- **Format:** step-by-step section on `/booksy-alternative` (the page already has a "What changes the day you switch" block; expand it rather than add a URL).
- **Owner page:** `/booksy-alternative`
- **Internal links in:** `/compare#who-owns-your-clients`, Insights second-visit end box (already points at `/compare#who-owns-your-clients`).
- **Links out:** `/free-preview`, `/pricing#plan`.
- **Source facts:** `BOOKSY_UK_COMMERCIAL_FACTS.clientListExportFormat` (checked 2 October 2026); Booksy Help Centre "Obtain a copy of your client list" source in `booksyFacts.ts`. KERSIVO side: setup "a few days" wording from `claimsPolicy.ts`. No promise that every client follows.

### 3. Fresha fees for barbershops — P1

- **Target search:** fresha fees uk / fresha new client fee / is fresha free for barbers
- **Format:** section on `/fresha-alternative`.
- **Owner page:** `/fresha-alternative`
- **Internal links in:** `/compare` Fresha row, calculator Fresha preset, Insights card-fees article (related reading, not body).
- **Links out:** calculator, `/free-preview`.
- **Source facts:** `FRESHA_UK_COMMERCIAL_FACTS.independentPlan`, `.teamPlanPerMember`, `.marketplaceNewClientFee`, `.marketplaceFeeMaximumCap`, `.marketplaceReturningClients`, `.onlinePayments`, `.inPersonPayments`, `.cardCaptureFee`, `.smartWebsiteAddOn` — checked 30 September 2026 (`FRESHA_FACTS_CHECKED_DATE`). Re-check before shipping.

### 4. Booking website vs marketplace: which one brings your clients back? — P1

- **Target search:** booking website vs marketplace barber / should my barbershop be on booksy / own booking site vs app
- **Format:** new Insights article (Tools & Payments). Buyer-adjacent, so it gets an end box.
- **Owner page:** the new article owns the "vs" search; it supports `/barbershop-websites`.
- **Internal links in:** do-barbers-need-a-website, Google booking link and local clients articles (related reading); `/barbershop-websites` FAQ.
- **Links out (≤3 commercial):** `/compare#new-client-fees` (body), `/barbershop-websites` (end box), `/free-preview` (end-box secondary).
- **Source facts:** marketplace new-client terms from `booksyFacts.ts` (`standardMarketplaceBooking`, `boostNewClientFee`), `freshaFacts.ts` (`marketplaceNewClientFee`, `directBookingLinks`), `treatwellFacts.ts` (`newMarketplaceClientCommission`, `directBookingMarketplaceCommission`), `vagaroFacts.ts` (`marketplaceNewClientFirstBookingPercent`). Each with its own checked date.

### 5. Deposits and no-shows by booking system — P1

- **Target search:** barber booking system with deposits uk / which booking app takes deposits / no show protection barber
- **Format:** new table section on `/compare` ("Deposits and no-show protection, platform by platform"), anchor `#deposits`.
- **Owner page:** `/compare`
- **Internal links in:** no-show Insights article (it is at the 3-link limit, so point its end box at `/compare#deposits` instead of adding a link), `/barbershop-no-show-calculator`, `/barbershop-cancellation-policy-template`.
- **Links out:** `/barbershop-online-booking` (KERSIVO deposit flow).
- **Source facts:** Booksy No-Show Protection source (`booksyFacts.ts`), Fresha payment policies source (`freshaFacts.ts`), Square deposits and cancellation sources (`squareFacts.ts`), Phorest online booking and deposits source (`phorestFacts.ts`), SQUIRE `onlineDepositProcessing` (`squireFacts.ts`). KERSIVO: fixed £5 deposit (`KERSIVO_BOOKING_DEPOSIT_GBP`), Starter rule vs Full choice, Stripe fees. Only list features a facts file marks as verified; leave a cell as "not published" otherwise.

### 6. Barber booking system UK: what to check before you choose — P2

- **Target search:** barber booking system uk checklist / how to choose barber booking software
- **Format:** new section on the home page below the product overview, or an FAQ block. **Not** a new URL: the home page owns "barber booking system uk" and is at position ~9–11 for the close variants.
- **Owner page:** `/`
- **Internal links in:** every new piece in this plan links to `/` with "barber booking system" once.
- **Links out:** `/compare`, `/pricing#plan`, `/free-preview`.
- **Source facts:** none from competitors. KERSIVO claims from `claimsPolicy.ts` only.

### 7. Treatwell commission for barbershops — P2

- **Target search:** treatwell commission uk / treatwell fees for barbers
- **Format:** section on `/treatwell-alternative`.
- **Owner page:** `/treatwell-alternative`
- **Internal links in:** `/compare` Treatwell row; new piece 4.
- **Source facts:** `TREATWELL_UK_COMMERCIAL_FACTS.newMarketplaceClientCommission`, `.repeatBookingMarketplaceCommission`, `.directBookingMarketplaceCommission`, `.onlinePrepaymentProcessing`, `.softwareMonthlySubscription`, `.newClientEligibility` — checked 8 October 2026.

### 8. Booking software cost for a 2, 4 and 6-chair shop — P2

- **Target search:** barber booking software cost per month uk / booking software for 4 barbers cost
- **Format:** worked-example section on `/barber-software-cost-calculator` (three preset team sizes), linking to the owner-earnings article's chair model.
- **Owner page:** `/barber-software-cost-calculator`
- **Internal links in:** owner-earnings Insights article (body link already there), `/compare#cost-by-team-size`.
- **Source facts:** whatever the calculator engine already uses (all `*Facts.ts` files, each with its own checked date). No new figures.

### 9. Moving booking systems without a gap in the diary — P2

- **Target search:** switch barber booking system / change booking software barbershop
- **Format:** new Insights article (Tools & Payments), brand-neutral checklist; the brand-specific "how to leave X" sections live on each alternative page.
- **Owner page:** the new article; it supports `/booksy-alternative`, `/fresha-alternative`, `/timely-alternative`.
- **Internal links in:** second-visit and local-clients articles (related reading).
- **Links out (≤3 commercial):** `/compare#who-owns-your-clients` (body), `/free-preview` (end box), one alternative page chosen by the export-format section.
- **Source facts:** client-export sources in `booksyFacts.ts`, `freshaFacts.ts`, `squareFacts.ts`, `vagaroFacts.ts`, `phorestFacts.ts`, `timelyFacts.ts` (data exports source, checked 14 November 2026). KERSIVO setup: "a few days" wording.

### 10. Does a barbershop need online booking? — P2

- **Target search:** do barbers need online booking / is online booking worth it barbershop
- **Format:** FAQ section on `/barbershop-online-booking` that links to the walk-ins article for the queue maths, not a new article (the walk-ins article already covers "walk-ins vs appointments" and ranks for it).
- **Owner page:** `/barbershop-online-booking`
- **Internal links in:** walk-ins article (body overlay already points here), December hours article.
- **Source facts:** none from competitors.

### 11. Card fees on bookings: Stripe vs platform payments — P2

- **Target search:** barber booking app card fees uk / booksy payment fees vs stripe
- **Format:** new table section on `/compare` (`#card-fees`), next to the existing new-client fees section.
- **Owner page:** `/compare`
- **Internal links in:** card-fees Insights article (end box already points at `/compare#new-client-fees`; move it to `#card-fees` when this ships, no extra link).
- **Source facts:** `stripeFacts.ts` (checked 1 October 2026), `BOOKSY_UK_COMMERCIAL_FACTS.mobilePayments` / `.tapToPay`, `FRESHA_UK_COMMERCIAL_FACTS.onlinePayments` / `.inPersonPayments`, `SQUARE_UK_PAYMENT_FACTS`, `TIMELY_COMMERCIAL_FACTS.ukOnlinePaymentProcessing`, `VAGARO_UK_COMMERCIAL_FACTS` card-fee source, `PHOREST_UK_COMMERCIAL_FACTS.onlinePaymentProcessingGbp`.

### 12. Free barber booking systems in the UK: what "free" means — P3

- **Target search:** free barber booking system uk / free booking app for barbers
- **Format:** section on `/starter` comparing what "free" means on each platform (marketplace fees, booking fees, payments). `/starter` already owns "free barber booking system uk"; this deepens it rather than creating a rival page.
- **Owner page:** `/starter`
- **Internal links in:** `/compare`, piece 4.
- **Links out:** `/pricing#plan` ("When Full is the better fit" box already exists).
- **Source facts:** `FRESHA_UK_COMMERCIAL_FACTS.independentPlan`, `NEARCUT_UK_COMMERCIAL_FACTS.freeForYouMonthlySubscription` / `.freeForYouCustomerBookingFeeExample`, `SQUARE_SUBSCRIPTION_FACTS.free`, each with its checked date. KERSIVO Starter wording only from `starterPage.ts` / `claimsPolicy.ts`.

### 13. Barbershop website with booking: what it should include — P3

- **Target search:** barbershop website with online booking / barber website with booking uk
- **Format:** checklist section on `/barbershop-websites` (position ~15 for its main search; better depth is the lever).
- **Owner page:** `/barbershop-websites`
- **Internal links in:** do-barbers-need-a-website, Google booking link, walk-ins articles (end boxes already point here).
- **Links out:** `/barbershop-website-design`, `/free-preview`.
- **Source facts:** `FRESHA_UK_COMMERCIAL_FACTS.smartWebsiteAddOn`, Setora websites source (`setoraFacts.ts`), Square online booking websites source (`squareFacts.ts`), SQUIRE `brandedLandingPageAddOn` — only if a competitor comparison is included.

### 14. Chair renters and booking software: who pays? — P3

- **Target search:** booking software for chair renters uk / does each barber need their own booking account
- **Format:** new Insights article (Business & Profit). Supports `/chair-rent-vs-commission-calculator` and `/compare#cost-by-team-size`. Not about payroll (the commission-pay article owns that).
- **Owner page:** the new article; the calculator keeps "chair rent vs commission".
- **Internal links in:** commission-pay and owner-earnings articles (related reading only — the commission-pay article stays at 0 commercial links).
- **Links out (≤3 commercial):** `/chair-rent-vs-commission-calculator` (callout), `/compare#cost-by-team-size` (end box).
- **Source facts:** per-seat terms: `BOOKSY_UK_COMMERCIAL_FACTS.additionalUser`, `FRESHA_UK_COMMERCIAL_FACTS.teamPlanPerMember`, `VAGARO_UK_COMMERCIAL_FACTS.additionalCalendarMonthlyGbp`, `TIMELY_COMMERCIAL_FACTS.unlimitedTeamMembers`, `SETORA_UK_COMMERCIAL_FACTS.unlimitedStaff`, `PHOREST_UK_COMMERCIAL_FACTS.addedStaffSubscriptionGbp`, SQUIRE `additionalBarberFee`. Employment-status wording must match the existing commission-pay article.

## Order of work

1. Pieces 1, 3, 5 and 11 (sections on pages that already rank or own the brand searches; facts already in the repo, re-check dates first).
2. Piece 4 and 9 (new Insights articles, buyer-adjacent).
3. Pieces 2, 6, 7, 8, 10.
4. Pieces 12–14.

## What to measure

For each piece, compare the 28 days before and after in Search Console: impressions and position for the target search on the **owner page**, and whether a second URL starts showing for the same search (a sign of competing pages). In GA4, track clicks from Insights owner notes and end boxes to commercial pages.

## Open questions for the founder

- Positions per page for the seven Insights articles were not in the export. Titles were left unchanged in Part A for that reason; if any article ranks outside the top 7 for its main search, a title test aimed at owners is worth discussing.
- Booksy (2 October) and Fresha (30 September) facts are over 40 days old. Pieces 1 and 3 need a re-check first.
