# GEO/AEO stage 2 — query fan-out map and changelog

Branch `seo/geo-aeo-2-fan-out`. Plan: `docs/seo/GEO-AEO-PLAN.md`, stage 2 (items 1–4; item 5 is its own batch).

AI assistants split one search ("best barber booking software UK") into sub-questions and pick the page that answers each one in a short, named passage. This map lists those sub-questions for each page that owns a buying search, and whether the page answers them. Checked on 26 November 2026 against the visible FAQs and copy on `main` @ `7bb0cc4b`.

✅ answered in its own FAQ item or section · ◐ answered inside another answer · ➕ added in this batch · — not this page's job

## Sub-questions per page

| Sub-question | `/` | `/compare` | `/pricing` | `/starter` | `/barbershop-websites` | `/barbershop-online-booking` |
|---|---|---|---|---|---|---|
| What does it cost for my team size? | ✅ | ✅ larger teams | ✅ per barber | ✅ how many barbers | ✅ | ◐ choose barber |
| Is there commission? Who pays card fees? | ✅ | ✅ | ✅ fees | ✅ | ◐ cost | ✅ |
| Can I take deposits / stop no-shows? | ✅ how clients pay | ◐ what to look for | ◐ Starter payments | ✅ | ✅ booking | ✅ |
| Do clients need an app? | ✅ | ➕ | — | ◐ free app question | — | ✅ |
| Can I move my clients from Booksy/Fresha? | ✅ | ✅ | ➕ | — (Full only) | ◐ timing | ✅ |
| Does it work with Google / Instagram? | ➕ | — | ◐ Starter includes | ✅ Google profile | ◐ need a website | ✅ |
| Are reminders included? | ➕ | ◐ what to look for | ✅ SMS | ➕ | ◐ booking | ✅ |
| Own website and domain? | ✅ | ✅ | ✅ Full adds | ✅ | ✅ | ✅ Starter vs Full |
| How long is setup? | ✅ | — | ✅ billing | ◐ Stripe | ✅ | ✅ (shared setup answer) |
| Can I cancel? | ✅ | — | ✅ | — | ✅ | ✅ |

| Sub-question | `/booksy-alternative` | `/fresha-alternative` | `/treatwell-alternative` | `/square-appointments-alternative` |
|---|---|---|---|---|
| What does the competitor cost in the UK? | ✅ | ✅ | ✅ | ✅ |
| Is KERSIVO cheaper / per barber? | ✅ | ✅ | ◐ | ✅ |
| Commission and card fees | ✅ | ✅ | ✅ | ✅ |
| Deposits | ◐ commission answer | ◐ commission, website | — | ✅ competitor side |
| Do clients need an app? | ✅ (now shared wording) | ✅ | — | ✅ |
| Move clients / keep the old system live | ✅ | ✅ | ✅ | ✅ |
| Marketplace discovery trade-off | ✅ | ✅ who it suits | ✅ | ✅ |

The four alternative pages already answer every sub-question; no changes there apart from the shared "app" wording.

## Short answer under the H1 (item 3)

Every page on the stage 2 list already opens with a direct answer under the H1, so no new block was added. Adding a second one would repeat the lead.

| Page | Direct answer under the H1 |
|---|---|
| `/` | Hero lead: own website and booking, £39/month per location, not per barber |
| `/starter` | `STARTER_FREE_QUALIFIER` + "Starter at a glance" key facts |
| `/barbershop-websites` | Hero lead: what the site is for, price |
| `/barbershop-online-booking` | `BOB_HERO.lead` (written as the quotable answer) + "in eight answers" glance |
| `/barbershop-reports` | "In short" block |
| `/barbershop-retail-pickup` | `RETAIL_PICKUP_HERO.lead` (40–60 word answer) |
| `/booksy-vs-fresha` | `BVF_DIRECT_ANSWER` |
| `/kersivo-vs-booksy` | `KVB_HERO.lead` |

## Chat-style questions from Search Console (item 4)

"How should a barbershop handle walk-ins during peak hours?" is answered at the top of `/insights/barbershop-walk-ins-vs-appointments` by the stage 1 short answer ("Should a barbershop take walk-ins or appointments, especially at peak hours?", an H2). The article body comes from the editorial pipeline, so its own headings were not changed.

## What changed

| File | Change |
|---|---|
| `src/lib/seo/barbershopBookingFaq.ts` | Shared answers `BOOKING_LINK_CHANNELS_FAQ`, `CONFIRMATIONS_REMINDERS_FAQ`, `MIGRATION_ASSISTANCE_FAQ`, `NO_CUSTOMER_APP_FAQ` (existing approved wording, moved, not rewritten). Homepage FAQ gains the Google/Instagram/TikTok and reminders questions. |
| `src/lib/seo/pricingPage.ts` | `/pricing` FAQ gains the migration question. |
| `src/lib/seo/starterPage.ts` | `/starter` FAQ gains "Does KERSIVO Starter send booking reminders?" (email on Starter, SMS within a monthly allowance on Full — same facts as `/pricing`). |
| `src/lib/seo/alternativesHubSeo.ts` | `/compare` FAQ gains "Do clients need to download an app to book with KERSIVO?" (the `/booksy-alternative` answer, now shared). |
| `src/lib/seo/booksyAlternativeFaq.ts` | Uses the shared app answer (text unchanged). |
| `src/lib/seo/queryFanOut.test.ts` | New. Each page carries its fan-out answers in the visible FAQ and FAQPage JSON-LD, the shared answers lead with the answer, no page repeats a question. |
| `src/lib/seo/alternativesHubPage.test.ts` | Hub FAQ count 7 → 8. |

No new claims, numbers or prices: every added answer is wording that was already live on another page.

## Next

- Stage 2 item 5: the P1 articles from `content-plan-buying-searches.md`, written answer-first. Separate batch.
- After merge: request reindexing of `/`, `/pricing`, `/starter` and `/compare` in GSC and Bing.
