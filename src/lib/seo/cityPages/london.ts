/**
 * London research for /barbershop-websites/london. Checked 24 November 2026.
 *
 * Rules (docs/seo/city-pages-playbook.md):
 * - every figure has a source in `sources` with the date we read it; third-party price surveys are
 *   presented as ranges from that survey, never as our own data;
 * - neighbourhood notes are set-up advice, not statistics; no invented footfall, rankings or counts;
 * - competitor fees are not written here: the page reads them from the shared *Facts.ts modules;
 * - tax and rates notes are general information with a pointer to the council/HMRC, not advice.
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
const stripeRate = `${STRIPE_UK_STANDARD_CARD_PERCENT}% + ${Math.round(STRIPE_UK_STANDARD_CARD_FIXED_GBP * 100)}p`;

export const LONDON_CITY_PAGE: CityPage = {
  slug: 'london',
  name: 'London',
  nation: 'England',
  checkedIso: CHECKED,
  checkedDate: '24 November 2026',
  h1Lead: 'Barbershop website design',
  h1Mark: 'for London shops',
  heroLead:
    `Your own domain, a website designed around your shop, online booking with deposits and a retail pickup shop for pomade, clay and beard oil. £${SAAS_MONTHLY_GBP}/month per location, flat, whether you run one chair in Walthamstow or six in Soho.`,
  hubSummary:
    'Fades from £20 to £42 at independent shops, a wider spread than in other UK cities, with set-ups for Soho, Walthamstow and the rest of the city.',
  targetQueries: [
    'barbershop website design London',
    'barber website London',
    'barbershop booking system London',
    'barber website with online booking London',
  ],
  calculator: {
    price: 26.5,
    priceNote: 'Typical skin fade at an independent London shop',
    priceSourceId: 'barberBoardPrices',
    barbers: 3,
    marketplaceClientsPerWeek: 4,
    noShowsPerWeek: 2,
  },
  prices: [
    { label: 'Skin fade, independent shop', value: '£20–£42', detail: 'typical £26.50', sourceId: 'barberBoardPrices' },
    { label: 'Skin fade, premium shop', value: '£43–£56', sourceId: 'barberBoardPrices' },
    { label: 'Short back and sides, independent', value: '£18–£28', sourceId: 'barberBoardPrices' },
    { label: 'Skin fade and beard, independent', value: '£27–£40', sourceId: 'barberBoardPrices' },
  ],
  chairRent: [
    { label: 'Chair rent, zones 1 and 2', value: '£150–£250', detail: 'a week, full time', sourceId: 'trimcheckChairRent' },
    { label: 'Chair rent, outer London', value: '£120–£180', detail: 'a week, full time', sourceId: 'trimcheckChairRent' },
  ],
  marketIntro: [
    'Prices in London spread wider than in other UK cities: in published price lists, a skin fade at an independent shop runs from £20 to £42, and premium shops charge more. A marketplace fee charged as a percentage grows with your prices; a flat monthly price does not.',
    'Clients usually find a shop the same way wherever they are in the city: a Maps search from where they are standing, a look at photos and prices, then a booking. Your job is to make the last two steps happen on your own website.',
  ],
  areas: [
    {
      id: 'central',
      name: 'Central London and the City',
      places: ['Soho', 'Fitzrovia', 'Farringdon', 'the City', 'Canary Wharf'],
      pattern:
        'When clients work nearby, they fit a cut around the working day, so lunchtime and after-work slots are the ones they look for.',
      setup: [
        'Put lunchtime and after-work slots online first, with each barber bookable by name.',
        `Take a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit at booking so a cancelled meeting does not leave a gap at 6pm.`,
        'Sell clay and pomade for pickup, so a client can grab it at the chair before heading back.',
      ],
    },
    {
      id: 'inner',
      name: 'Inner-London high streets',
      places: ['Peckham', 'Brixton', 'Dalston', 'Tottenham', 'Walthamstow'],
      pattern:
        'Shops here often mix regulars and walk-ins, Saturday slots tend to go first, and new clients find you on Instagram as well as on Maps.',
      setup: [
        'Say on your website whether and when you take walk-ins, so nobody is turned away by mistake.',
        'Point your Instagram bio and Business Profile at the same booking page on your own domain.',
        'Send regulars your booking link once, so they rebook online instead of by DM.',
      ],
    },
    {
      id: 'outer',
      name: 'Outer-London town centres',
      places: ['Croydon', 'Ilford', 'Harrow', 'Romford', 'Kingston'],
      pattern:
        'Shops here often see family visits and kids’ cuts, and clients who arrive by car or bus.',
      setup: [
        'List kids’ cuts as their own service with their own price and length.',
        'Put parking and bus details on the website, where people look before they set off.',
        'Use email and SMS reminders so a Saturday booking made on Tuesday isn’t forgotten.',
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
        'From 1 April 2026 England replaced the old retail discount with lower multipliers for qualifying retail, hospitality and leisure properties: 38.2p for a rateable value under £51,000 and 43.0p from £51,000 to £499,999, against 43.2p and 48.0p for other properties.',
        'The lower multipliers are for properties wholly or mainly used for retail, hospitality or leisure and open to visiting members of the public; under the old discount, councils listed hairdressers among qualifying hair and beauty uses. Your borough decides whether your shop qualifies. Small business rate relief still means no rates on a single property with a rateable value of £12,000 or less, tapering to nothing at £15,000. The City of London sets its own multiplier.',
      ],
      sourceIds: ['govMultipliers', 'rbkcRates2026', 'govSbrr'],
    },
    {
      id: 'mtd',
      title: 'Making Tax Digital',
      figure: '£30,000',
      figureLabel: 'turnover threshold from 6 April 2027',
      body: [
        'From 6 April 2027, sole traders and landlords with turnover over £30,000 must keep digital records and send HMRC quarterly updates through recognised software. That can include self-employed barbers renting a chair. Turnover means gross self-employment and property income before expenses.',
        'The threshold is due to fall to £20,000 from April 2028. A booking system with clean takings records makes the quarterly updates easier, but it is not tax software. This is general information, not tax advice.',
      ],
      sourceIds: ['govMtd'],
    },
    {
      id: 'cards',
      title: 'Card fees',
      figure: stripeRate,
      figureLabel: 'Stripe standard UK card rate',
      body: [
        `Online deposits and payments on KERSIVO go through your shop’s own Stripe account. Stripe’s standard UK card rate is ${stripeRate}; premium and international cards cost more. KERSIVO adds 0% commission on top. ${STRIPE_FEES_NOTE}`,
        'In-shop card terminals are a separate choice with their own rates, so compare them on their own.',
      ],
      sourceIds: ['stripeUk'],
    },
  ],
  journey: {
    district: 'Peckham',
    near: 'Rye Lane',
    query: 'barber near me',
    shopName: 'Heritage Grooming',
    shopDomain: 'heritagegrooming.co.uk',
    service: 'Skin fade',
    slot: 'Sat 10:15',
    product: 'Matt clay',
    productPrice: 14,
    shelf: [
      { name: 'Water-based pomade', price: 12 },
      { name: 'Beard oil', price: 15 },
    ],
  },
  faqs: [
    {
      id: 'switch',
      question: 'Can I move my London shop off Booksy or Fresha without losing my regulars?',
      answer: [
        'Yes, if you plan the switch. Where possible, your current bookings can continue while we prepare your website. Then put the new booking link everywhere your regulars already look: your Google Business Profile, your Instagram bio and the window.',
        'Fresha lets you export your client list; on Booksy you request a copy from Booksy Support. We can help move eligible information exported from your current provider. Some history may not transfer.',
      ],
    },
    {
      id: 'deposits',
      question: 'Should I take deposits on Saturday and after-work slots in London?',
      answer: [
        `If no-shows are costing you your busiest slots, a deposit is the simplest fix. With Full KERSIVO you choose how online bookings are paid: Pay at shop with nothing upfront, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit capped at the service price, or full payment online.`,
        `The setting applies to all of your shop’s online bookings, not slot by slot, so the £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit is the lighter option if you want protection without asking regulars to pay in full upfront. Deposits and full payment need your shop’s connected Stripe account. ${STRIPE_FEES_NOTE}`,
      ],
    },
    {
      id: 'google',
      question: 'Will a website help my shop show up on Google Maps in my part of London?',
      answer: [
        'Google says local results are based mainly on relevance, distance and prominence, and that nobody can pay for a better local ranking. You can’t change your distance from the person searching, but you can make it clear what you do and where.',
        'A website on your own domain that lists your services, prices, area and hours, linked from your Business Profile as your website and booking link, gives Google and clients the same clear answer. Reviews on your Business Profile matter too. No website can guarantee a position in the map results.',
      ],
    },
    {
      id: 'costs',
      question: 'What do business rates and other costs look like for a London barbershop in 2026/27?',
      answer: [
        'Since 1 April 2026, qualifying retail, hospitality and leisure properties in England pay a lower multiplier: 38.2p under £51,000 rateable value and 43.0p up to £499,999. Your borough decides whether your shop qualifies, and the City of London sets its own multiplier. Small business rate relief still covers a single property up to £12,000, tapering to £15,000.',
        'From 6 April 2027, self-employed barbers with turnover over £30,000 also need to keep digital records for Making Tax Digital. This is general information, not tax advice; check your bill with your council and your tax position with HMRC or an accountant.',
      ],
    },
    {
      id: 'price',
      question: 'How much does a barbershop website in London cost with KERSIVO?',
      answer: [
        `Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location, the same in London as anywhere else in the UK, and not per barber. There is no setup fee and no VAT added. It includes your website on your own domain, online booking with deposits, the retail pickup shop and reminders.`,
        `KERSIVO takes 0% commission on bookings and retail. ${STRIPE_FEES_NOTE} If you only need online bookings without your own website, KERSIVO Starter is £0/month for up to 4 barbers.`,
      ],
    },
  ],
  sources: [
    {
      id: 'barberBoardPrices',
      label: 'The Barber Board: How much should a haircut cost in the UK?',
      url: 'https://thebarberboard.com/guides/how-much-should-a-haircut-cost-uk/',
      supports: 'London haircut and skin fade price ranges, from published price lists of about 15 London shops read on 28 September 2026',
      checkedIso: CHECKED,
      pageDate: 'updated 1 November 2026',
    },
    {
      id: 'trimcheckChairRent',
      label: 'TrimCheck: Rent a chair in a barbershop (UK)',
      url: 'https://trimcheck.com/chair-rental/',
      supports: 'London chair rent ranges, from public chair adverts sampled on 23 September 2026 (a chair-listing site’s estimate)',
      checkedIso: CHECKED,
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
      id: 'rbkcRates2026',
      label: 'Royal Borough of Kensington and Chelsea: Business rate changes from 1 April 2026',
      url: 'https://www.rbkc.gov.uk/business-and-enterprise/business-rates/business-rate-changes-1-april-2026',
      supports: 'the retail, hospitality and leisure multipliers replacing the retail discount, their conditions and the hair and beauty uses listed by the council',
      checkedIso: CHECKED,
      pageDate: 'updated 6 July 2026',
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
