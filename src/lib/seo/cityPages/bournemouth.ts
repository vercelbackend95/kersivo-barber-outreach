/**
 * Bournemouth research for /barbershop-websites/bournemouth. Checked 24 November 2026.
 *
 * Written from scratch for Bournemouth (not adapted from london.ts). Rules (docs/seo/city-pages-playbook.md):
 * - prices are our own read of published prices on Booksy's Bournemouth listings on the check date,
 *   shown as ranges with the source named; the Barber Board big-city band is shown only as a comparison;
 * - there is no published Bournemouth chair-rent survey, so the page shows the two town-centre adverts we
 *   could read and says that both had stopped taking enquiries;
 * - area notes are set-up advice, not statistics; no invented footfall, rankings or counts;
 * - competitor fees are read from the shared *Facts.ts modules, never typed here;
 * - rates and tax notes are general information with a pointer to BCP Council and HMRC, not advice.
 */
import { KERSIVO_BOOKING_DEPOSIT_GBP, SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { STRIPE_FEES_NOTE } from '@/lib/pricing/claimsPolicy';
import {
  STRIPE_FACTS_CHECKED_ISO,
  STRIPE_SOURCE_UK_PRICING,
  STRIPE_UK_STANDARD_CARD_FIXED_GBP,
  STRIPE_UK_STANDARD_CARD_PERCENT,
} from '@/lib/seo/stripeFacts';
import type { CityPage } from './types';

const CHECKED = '2026-11-24';
const MEDIAN_FADE = 20;
const stripeRate = `${STRIPE_UK_STANDARD_CARD_PERCENT}% + ${Math.round(STRIPE_UK_STANDARD_CARD_FIXED_GBP * 100)}p`;
/** Stripe's standard UK card fee on an amount, in pence (rounded to the nearest penny). */
const stripePence = (amountGbp: number) =>
  Math.round(amountGbp * STRIPE_UK_STANDARD_CARD_PERCENT + STRIPE_UK_STANDARD_CARD_FIXED_GBP * 100);
const depositFee = stripePence(KERSIVO_BOOKING_DEPOSIT_GBP);
const fullFadeFee = stripePence(MEDIAN_FADE);

export const BOURNEMOUTH_CITY_PAGE: CityPage = {
  slug: 'bournemouth',
  name: 'Bournemouth',
  nation: 'England',
  checkedIso: CHECKED,
  checkedDate: '24 November 2026',
  h1Lead: 'Barbershop website design',
  h1Mark: 'for Bournemouth shops',
  heroLead:
    `A website on your own .co.uk, designed around your shop, with online booking, deposits on the slots that go first and a pickup shelf for clay, pomade and beard oil. One flat £${SAAS_MONTHLY_GBP}/month per location and 0% KERSIVO commission (Stripe fees apply), whether you cut on Wimborne Road in Winton or Christchurch Road in Boscombe.`,
  hubSummary:
    'A £20 middle fade price, student terms and summer visitors, with set-ups for the town centre, Boscombe to Southbourne and Winton.',
  seoTitle: `Barbershop Website Design Bournemouth: Own .co.uk, £${SAAS_MONTHLY_GBP}/mo`,
  seoDescription:
    `Students in term, visitors in summer: let them book your real free slots on your own .co.uk. £${SAAS_MONTHLY_GBP}/month flat. 0% KERSIVO commission (Stripe fees apply).`,
  targetQueries: [
    'barbershop website design Bournemouth',
    'barber website Bournemouth',
    'barbershop booking system Bournemouth',
    'barber website with online booking Bournemouth',
  ],
  calculator: {
    price: MEDIAN_FADE,
    priceNote: 'Middle skin fade price on Bournemouth Booksy listings',
    priceSourceId: 'booksyBournemouthFade',
    barbers: 2,
    marketplaceClientsPerWeek: 3,
    noShowsPerWeek: 2,
  },
  prices: [
    { label: 'Skin fade, Bournemouth listings', value: '£16–£30', detail: 'middle price £20, 15 shops', sourceId: 'booksyBournemouthFade' },
    { label: 'Men’s haircut, Bournemouth listings', value: '£13–£23', detail: '5 shops with a plain haircut price', sourceId: 'booksyBournemouthBarbers' },
    { label: 'Skin fade, UK towns (for comparison)', value: '£15–£27', detail: 'typical £19', sourceId: 'barberBoardPrices' },
    { label: 'Skin fade, UK big cities (for comparison)', value: '£16–£30', detail: 'typical £22', sourceId: 'barberBoardPrices' },
  ],
  chairRent: [
    { label: 'Chair advert, town centre (BH1)', value: '£150', detail: 'a week, salon chair; no longer taking enquiries', sourceId: 'uktrChairBh1' },
    { label: 'Chair advert, town centre (BH2)', value: '£50', detail: 'a day, hair, barber or nails; no longer taking enquiries', sourceId: 'uktrChairBh2' },
  ],
  marketIntro: [
    'Bournemouth cuts are priced between a UK town and a big city, well below London. On 24 November 2026 Booksy’s Bournemouth skin fade search listed 32 businesses; the 15 barbershops on its first page with a stand-alone fade price charged £16 to £30, and the middle price was £20, between the Barber Board’s typical town (£19) and big-city (£22) fade. On cheaper cuts the marketplace minimums bite: a £5 minimum fee on a £16 fade is almost a third of the ticket.',
    'Nobody publishes a Bournemouth chair-rent survey. The two town-centre chair adverts we could read asked £150 a week and £50 a day, and both had stopped taking enquiries, so treat them as a guide only. TrimCheck’s UK guide puts a 60/40 split in the barber’s favour as common outside London; your own agreement is what counts.',
    'The year has more shape here than in most places: Bournemouth University and Arts University Bournemouth bring students in for term time, and the seafront brings visitors in summer. A booking page that shows your real free slots does the most work in the weeks those clients arrive.',
  ],
  areas: [
    {
      id: 'centre',
      name: 'Town centre, Lansdowne and Westbourne',
      places: ['Old Christchurch Road', 'the Lansdowne', 'Holdenhurst Road', 'Westover Road', 'Westbourne'],
      pattern:
        'Office workers, students from the Lansdowne campus and, in summer, people walking up from the seafront pass the same few streets, so walk-ins and online bookings land in the same afternoon.',
      setup: [
        'Say on the website which hours you keep for walk-ins, and keep the rest of the day bookable online.',
        'List a student fade as its own service with its own price, so students see it before they walk in.',
        'Put clay and pomade on the pickup shelf for clients who are heading straight back to work.',
      ],
    },
    {
      id: 'east',
      name: 'Boscombe to Southbourne',
      places: ['Boscombe', 'Pokesdown', 'Southbourne', 'Tuckton', 'Iford'],
      pattern:
        'Christchurch Road and Southbourne Grove mostly serve people who live nearby, so shops here often lean on regulars who rebook every few weeks, and Saturday mornings fill first.',
      setup: [
        'Send each regular your booking link once, so the next cut is booked online rather than by text.',
        `Take a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit on online bookings if Saturday no-shows are costing you the morning.`,
        'Turn on email and SMS reminders, within a monthly allowance, for bookings made weeks ahead.',
      ],
    },
    {
      id: 'north',
      name: 'Winton, Charminster and Kinson',
      places: ['Winton', 'Moordown', 'Charminster', 'Ensbury Park', 'Kinson'],
      pattern:
        'Wimborne Road and Charminster Road mix student lets with family streets, so the diary moves with the university year and school holidays bring kids’ cuts.',
      setup: [
        'List kids’ cuts and student cuts as separate services, each with its own price and length.',
        'Use one booking address everywhere, from your Instagram bio to the card on the mirror, so students who move house each year can still find you.',
        'Put parking and bus details on the contact page for clients coming in from Kinson or Ensbury Park.',
      ],
    },
  ],
  costs: [
    {
      id: 'rates',
      title: 'Business rates 2026/27',
      figure: '38.2p',
      figureLabel: 'small business retail, hospitality and leisure multiplier',
      body: [
        'Bournemouth shops pay business rates to BCP Council (Bournemouth, Christchurch and Poole). Since 1 April 2026, qualifying retail, hospitality and leisure properties in England use lower multipliers: 38.2p below £51,000 rateable value and 43p from £51,000 to £499,999. Other properties pay 43.2p and 48p.',
        'HM Treasury’s guidance lists hair and beauty salons, including hairdressers, among the qualifying services, and says an appointment-only shop still counts as open to visiting members of the public. BCP Council decides whether your shop qualifies. Small business rate relief still covers a single property up to £12,000 rateable value, tapering to £15,000, and you now keep it for three years after taking on a second shop.',
      ],
      sourceIds: ['bcpRates2026', 'hmtRhlGuidance', 'govMultipliers', 'govSbrr'],
    },
    {
      id: 'mtd',
      title: 'Making Tax Digital',
      figure: '£30,000',
      figureLabel: 'turnover test from 6 April 2027',
      body: [
        'If you are self-employed, cutting from a rented chair or running your own shop as a sole trader, and your self-employment and property turnover is over £30,000 before expenses, Making Tax Digital for Income Tax starts for you on 6 April 2027: digital records and quarterly updates to HMRC through recognised software.',
        'The test drops to £20,000 from April 2028. A booking system that records what you took makes the quarterly figures easier to pull together, but it is not tax software. General information, not tax advice.',
      ],
      sourceIds: ['govMtd'],
    },
    {
      id: 'cards',
      title: 'Card fees on deposits',
      figure: `${depositFee}p`,
      figureLabel: `Stripe’s standard fee on a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit, rounded`,
      body: [
        `Deposits and online payments go through your shop’s own Stripe account at Stripe’s standard UK card rate of ${stripeRate}, which is about ${depositFee}p on a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit or ${fullFadeFee}p on a £${MEDIAN_FADE} fade paid in full. Premium and international cards cost more. KERSIVO itself takes 0% commission on those payments. ${STRIPE_FEES_NOTE}`,
        'A card reader at the chair is a separate decision with its own rates.',
      ],
      sourceIds: ['stripeUk'],
    },
  ],
  journey: {
    district: 'Winton',
    near: 'Wimborne Road',
    query: 'barber near me',
    shopName: 'Heritage Grooming',
    shopDomain: 'heritagegrooming.co.uk',
    service: 'Skin fade',
    slot: 'Thu 17:30',
    product: 'Texture clay',
    productPrice: 13,
    shelf: [
      { name: 'Fibre pomade', price: 12 },
      { name: 'Beard oil', price: 14 },
    ],
  },
  faqs: [
    {
      id: 'switch',
      question: 'Can my Bournemouth regulars keep booking while I move off Booksy or Fresha?',
      answer: [
        'Yes. Where possible, keep taking bookings where you are now while we build your website, and switch only once your own booking page is ready. On the day you switch, change the booking link on your Google Business Profile and in your Instagram bio, and tell regulars at the chair.',
        'If you have student clients, a switch before the September or January term means they meet the new link when they come back. Fresha lets you export your client list; Booksy asks you to request it from Booksy Support. We can help move eligible information exported from your current provider. Some history may not transfer.',
      ],
    },
    {
      id: 'deposits',
      question: 'Is it worth taking deposits from Bournemouth clients on busy summer Saturdays?',
      answer: [
        `It depends on how often an empty chair costs you a paying client. With Full KERSIVO your shop picks one way for all online bookings to be paid: Pay at shop, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit capped at the service price, or the full price online. It is one setting for the shop, not something you switch on for Saturdays only.`,
        `On a £${MEDIAN_FADE} fade, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit is a quarter of the price: it does not cover a missed cut, but a no-show stops being a total loss and the client has something at stake. Deposits and full payment need your shop’s Stripe account connected. ${STRIPE_FEES_NOTE}`,
      ],
    },
    {
      id: 'google',
      question: 'How does a Bournemouth barbershop show up in Google Maps for “barber near me”?',
      answer: [
        'Google says local results depend mainly on relevance, distance and prominence, and that you cannot pay to rank higher in them. Someone searching on Wimborne Road will usually see shops close to Wimborne Road, so the part you control is how clearly Google can see what you do and where.',
        'Name your area and street on your website, list your services and prices, keep your hours current on your Business Profile, and add your own site as both the website and the booking link. Reviews on the profile help too. No website or provider can promise a place in the map results.',
      ],
    },
    {
      id: 'costs',
      question: 'What will business rates cost my Bournemouth barbershop in 2026/27?',
      answer: [
        'That depends on your rateable value and on whether BCP Council treats your shop as a retail, hospitality or leisure property. HM Treasury’s guidance lists hairdressers among the qualifying hair and beauty salons; if your shop qualifies and is below £51,000 rateable value, the multiplier is 38.2p instead of 43.2p. Small business rate relief covers a single property up to £12,000, tapering to nothing at £15,000, and you apply for it to BCP Council.',
        'If you are self-employed with turnover over £30,000, Making Tax Digital for Income Tax also starts on 6 April 2027. This is general information, not tax advice; BCP Council confirms your bill and HMRC or an accountant your tax position.',
      ],
    },
    {
      id: 'price',
      question: 'What does a barbershop website cost a Bournemouth shop on KERSIVO?',
      answer: [
        `Full KERSIVO costs £${SAAS_MONTHLY_GBP}/month per location, not per barber, and it costs the same in Bournemouth as anywhere else in the UK. No setup fee, and no VAT is added to the price. That covers your website on your own domain, online booking with deposits, the retail pickup shop and reminders.`,
        `KERSIVO takes 0% commission on bookings and products. ${STRIPE_FEES_NOTE} If you only want online booking for now, KERSIVO Starter is £0/month for up to 4 barbers.`,
      ],
    },
  ],
  sources: [
    {
      id: 'booksyBournemouthFade',
      label: 'Booksy: Skin Fade in Bournemouth, England',
      url: 'https://booksy.com/en-gb/s/skin-fade/1029122_bournemouth',
      supports:
        'the Bournemouth skin fade range and middle price: our read of the published list prices of the 15 barbershops with a stand-alone fade on the first results page (32 results listed); mobile barbers left out, list prices used where a discount was shown',
      checkedIso: CHECKED,
    },
    {
      id: 'booksyBournemouthBarbers',
      label: 'Booksy: Barber Shop in Bournemouth, England',
      url: 'https://booksy.com/en-gb/s/barber-shop/1029122_bournemouth',
      supports: 'the Bournemouth men’s haircut range, from the 5 barbershops with a plain haircut price on the first results page',
      checkedIso: CHECKED,
    },
    {
      id: 'barberBoardPrices',
      label: 'The Barber Board: How much should a haircut cost in the UK?',
      url: 'https://thebarberboard.com/guides/how-much-should-a-haircut-cost-uk/',
      supports: 'the UK town and big-city skin fade ranges used for comparison, from about 150 UK price lists read on 28 September 2026',
      checkedIso: CHECKED,
      pageDate: 'updated 1 November 2026',
    },
    {
      id: 'uktrChairBh1',
      label: 'UK Therapy Rooms: Salon Chair for Rent, Bournemouth BH1',
      url: 'https://www.uktherapyrooms.co.uk/england/bournemouth/therapy-room/salon-chair-for-rent',
      supports: 'a town-centre salon chair advertised at £150 a week, self-employed; the listing was no longer taking enquiries',
      checkedIso: CHECKED,
    },
    {
      id: 'uktrChairBh2',
      label: 'UK Therapy Rooms: Chair rental in main town centre Bournemouth, BH2',
      url: 'https://www.uktherapyrooms.co.uk/england/bournemouth/therapy-room/chair-rental-in-main-town-centre-bournemouth',
      supports: 'a town-centre chair for hair, barber or nail specialists advertised at £50 a day; the listing was no longer taking enquiries',
      checkedIso: CHECKED,
    },
    {
      id: 'trimcheckChairRent',
      label: 'TrimCheck: Rent a chair in a barbershop (UK)',
      url: 'https://trimcheck.com/chair-rental/',
      supports: 'commission splits commonly used outside London (a chair-listing site’s ranges from adverts sampled on 23 September 2026)',
      checkedIso: CHECKED,
    },
    {
      id: 'bcpRates2026',
      label: 'BCP Council: Important changes to business rates in 2026',
      url: 'https://www.bcpcouncil.gov.uk/business/business-rates/important-changes-to-business-rates-in-2026',
      supports: 'the 2026/27 multipliers in the BCP area, the council deciding eligibility, and keeping small business rate relief for three years after taking on a second property',
      checkedIso: CHECKED,
    },
    {
      id: 'hmtRhlGuidance',
      label: 'GOV.UK: Business Rates Multipliers: Qualifying Retail, Hospitality or Leisure',
      url: 'https://www.gov.uk/guidance/business-rates-multipliers-qualifying-retail-hospitality-or-leisure',
      supports: 'hair and beauty salons, including hairdressers, as qualifying services, and appointment-only premises still counting as open to visiting members of the public',
      checkedIso: CHECKED,
      pageDate: 'updated 30 March 2026',
    },
    {
      id: 'govMultipliers',
      label: 'GOV.UK: Notification of non-domestic rating multipliers for 2026/27',
      url: 'https://www.gov.uk/government/publications/22026-notification-of-non-domestic-rating-multipliers-for-202627/22026-notification-of-non-domestic-rating-multipliers-for-202627',
      supports: 'the 2026/27 multipliers for England',
      checkedIso: CHECKED,
      pageDate: 'published 10 February 2026',
    },
    {
      id: 'govSbrr',
      label: 'GOV.UK: Small business rate relief',
      url: 'https://www.gov.uk/business-rates-relief/small-business-rate-relief',
      supports: 'small business rate relief thresholds',
      checkedIso: CHECKED,
    },
    {
      id: 'govMtd',
      label: 'GOV.UK: Sole traders and landlords earning more than £30,000 urged to act now',
      url: 'https://www.gov.uk/government/news/sole-traders-and-landlords-earning-more-than-30000-urged-to-act-now',
      supports: 'Making Tax Digital for Income Tax from 6 April 2027, the £30,000 turnover test and the April 2028 threshold',
      checkedIso: CHECKED,
      pageDate: 'published 5 October 2026',
    },
    {
      id: 'googleLocalRanking',
      label: 'Google Business Profile Help: Tips to improve your local ranking on Google',
      url: 'https://support.google.com/business/answer/7091?hl=en-GB',
      supports: 'relevance, distance and prominence, and that local ranking cannot be paid for',
      checkedIso: CHECKED,
    },
    {
      id: 'googleBusinessLinks',
      label: 'Google Business Profile Help: Manage your local business links',
      url: 'https://support.google.com/business/answer/6218037?hl=en-GB',
      supports: 'adding your own booking link to a Business Profile',
      checkedIso: CHECKED,
    },
    {
      id: 'stripeUk',
      label: 'Stripe UK pricing',
      url: STRIPE_SOURCE_UK_PRICING,
      supports: 'the standard UK card rate',
      checkedIso: STRIPE_FACTS_CHECKED_ISO,
    },
  ],
};
