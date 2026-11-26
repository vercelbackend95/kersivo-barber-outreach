/**
 * Birmingham research for /barbershop-websites/birmingham. Checked 24 November 2026.
 *
 * Written from scratch for Birmingham (not adapted from london.ts or bournemouth.ts). Rules
 * (docs/seo/city-pages-playbook.md):
 * - prices are our own read of the published list prices on the first page of Booksy's Birmingham skin fade
 *   search on the check date (15 barbershops with a stand-alone adult fade), split by B1–B5 postcode;
 *   the Barber Board big-city band is shown only as a comparison;
 * - chair rent is TrimCheck's published band for Birmingham and the other big regional cities, named as its
 *   estimate; no Birmingham chair advert with a price could be read on the check date;
 * - area notes are set-up advice, not statistics; no invented footfall, rankings or counts;
 * - competitor fees are read from the shared *Facts.ts modules, never typed here;
 * - rates and tax notes are general information pointing to Birmingham City Council and HMRC, not advice.
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
const MIDDLE_FADE = 25;
const stripeRate = `${STRIPE_UK_STANDARD_CARD_PERCENT}% + ${Math.round(STRIPE_UK_STANDARD_CARD_FIXED_GBP * 100)}p`;
/** Stripe's standard UK card fee on an amount, in pence (rounded to the nearest penny). */
const stripePence = (amountGbp: number) =>
  Math.round(amountGbp * STRIPE_UK_STANDARD_CARD_PERCENT + STRIPE_UK_STANDARD_CARD_FIXED_GBP * 100);
const depositFee = stripePence(KERSIVO_BOOKING_DEPOSIT_GBP);
const fullFadeFee = stripePence(MIDDLE_FADE);

export const BIRMINGHAM_CITY_PAGE: CityPage = {
  slug: 'birmingham',
  name: 'Birmingham',
  nation: 'England',
  checkedIso: CHECKED,
  checkedDate: '24 November 2026',
  h1Lead: 'Barbershop website design',
  h1Mark: 'for Birmingham shops',
  heroLead:
    `From the Jewellery Quarter and Digbeth to Moseley and Sutton Coldfield: a custom-designed website on your shop’s own domain, online booking that can take a deposit, and a retail pickup shop for beard oil and clay. £${SAAS_MONTHLY_GBP}/month flat per location with 0% KERSIVO commission (Stripe fees apply), so the clients Google sends you book with you, not through a directory.`,
  hubSummary:
    'A £25 middle fade that moves with the postcode, three universities and a strong walk-in trade, with set-ups for the centre, Moseley to Harborne and Sutton Coldfield.',
  seoTitle: `Barbershop Website Design Birmingham: £${SAAS_MONTHLY_GBP} Flat, Own Domain`,
  seoDescription:
    `On a £15 Birmingham fade, Booksy Boost’s £5 minimum takes a third. Own site, booking, deposits: £${SAAS_MONTHLY_GBP}/month flat. 0% KERSIVO commission (Stripe fees apply).`,
  targetQueries: [
    'barbershop website design Birmingham',
    'barber website Birmingham',
    'barbershop booking system Birmingham',
    'barber website with online booking Birmingham',
  ],
  calculator: {
    price: MIDDLE_FADE,
    priceNote: 'Middle adult skin fade price across 15 Birmingham Booksy listings',
    priceSourceId: 'booksyBirminghamFade',
    barbers: 3,
    marketplaceClientsPerWeek: 4,
    noShowsPerWeek: 2,
  },
  prices: [
    { label: 'Skin fade, Birmingham listings', value: '£15–£38', detail: 'middle price £25, 15 shops', sourceId: 'booksyBirminghamFade' },
    { label: 'Skin fade, city-centre postcodes B1–B5', value: '£23–£38', detail: '7 of the 15 shops', sourceId: 'booksyBirminghamFade' },
    { label: 'Skin fade, outside B1–B5', value: '£15–£25', detail: '8 of the 15 shops, Digbeth to Acocks Green', sourceId: 'booksyBirminghamFade' },
    { label: 'Skin fade, UK big cities (for comparison)', value: '£16–£30', detail: 'typical £22', sourceId: 'barberBoardPrices' },
  ],
  chairRent: [
    { label: 'Full-time chair, Birmingham and other big cities', value: '£90–£150', detail: 'a week, or £20–£35 a day; TrimCheck’s estimate', sourceId: 'trimcheckChairRent' },
    { label: 'Split instead of rent', value: '60/40', detail: 'in the barber’s favour, TrimCheck’s estimate', sourceId: 'trimcheckChairRent' },
  ],
  marketIntro: [
    'In Birmingham the postcode moves the price more than the haircut does. Booksy’s Birmingham skin fade search returned 45 businesses on 24 November 2026, and we read the 15 barbershops on its first page that show a stand-alone adult fade. Their list prices ran from £15 to £38, with £25 in the middle. The seven in the B1 to B5 city-centre postcodes, from Temple Street to Brindleyplace, asked £23 to £38; the eight outside them, from Bradford Street in Digbeth out to Kings Heath and Acocks Green, asked £15 to £25.',
    'Cheap cuts are where marketplace fees hurt most. Booksy Boost charges at least £5 for a new client, and on a £15 fade that minimum takes a third of the ticket before you have picked up the clippers. For chair rent, TrimCheck’s UK guide puts Birmingham in the same band as Manchester, Leeds and Glasgow: £90 to £150 a week for a full-time chair, £20 to £35 a day, or a 60/40 split instead of rent. That is its estimate from adverts sampled on 23 September 2026, not a Birmingham survey; your own agreement is what counts.',
    'Three universities set the calendar: the University of Birmingham at Edgbaston, and Aston and Birmingham City University in the city centre. Every September and January brings people who have never sat in your chair, which is exactly when a marketplace charges its new-client fee and a link to your own site does not. Plenty of Birmingham shops also keep the door open for walk-ins all day; online booking works alongside that, holding back the slots you want spoken for.',
  ],
  areas: [
    {
      id: 'centre',
      name: 'City Centre, Jewellery Quarter and Digbeth',
      places: ['Colmore Row', 'the Jewellery Quarter', 'Digbeth', 'Hurst Street', 'Brindleyplace'],
      pattern:
        'Office workers around Colmore Row and creative studios in Digbeth keep similar hours, so the diary is quiet mid-morning, busy at lunch and busiest once offices empty after five, with students from Aston and BCU filling the gaps in between.',
      setup: [
        'Break the lunch hour and the hours after five into short online slots, so a fade fits a break or the walk to New Street.',
        'Offer back and sides only as its own shorter service, for clients who are due back at their desk.',
        'Name the nearest station on the contact page, whether that is New Street, Moor Street, Snow Hill or the Jewellery Quarter stop.',
      ],
    },
    {
      id: 'south',
      name: 'Moseley, Kings Heath and Harborne',
      places: ['Moseley Village', 'Alcester Road', 'Kings Heath High Street', 'Harborne High Street', 'Stirchley'],
      pattern:
        'These are high streets people walk to, lined with independent cafés and shops, where regulars come back to the same barber on a steady rhythm and Saturday morning is the first part of the week to go.',
      setup: [
        'Give each barber a profile on the booking page, so a regular picks the person they always see and not just a time.',
        'Stock the pickup shelf with beard oil, balm and a matte paste, since a client who returns every few weeks runs out on the same rhythm.',
        `Turn on the £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit if late Saturday cancellations leave gaps you cannot fill from the door.`,
      ],
    },
    {
      id: 'outer',
      name: 'Sutton Coldfield, Erdington and the outer suburbs',
      places: ['Sutton Coldfield', 'Erdington', 'Great Barr', 'Acocks Green', 'Northfield'],
      pattern:
        'Further out the trade is more family-shaped: dads and sons book on the same Saturday morning, and most clients arrive by car or by bus, or ride the Cross City line, so getting there matters as much as the price.',
      setup: [
        'List kids’ cuts with an age limit and their own shorter time, so a parent sees the price before booking.',
        'Put parking, the nearest bus route and the closest Cross City station on the contact page.',
        'Use email and SMS reminders, with SMS within a monthly allowance, so a family that needs to rearrange does it before Saturday rather than on it.',
      ],
    },
  ],
  costs: [
    {
      id: 'rates',
      title: 'Business rates 2026/27',
      figure: '38.2p',
      figureLabel: 'small business retail, hospitality and leisure (RHL) multiplier',
      body: [
        'Birmingham City Council lists five multipliers from 1 April 2026: 38.2p for small business RHL properties, 43.2p for other small business properties, 43.0p and 48.0p for the standard bands, and 50.8p for high-value properties. The small business multipliers apply below £51,000 rateable value. HM Treasury’s guidance counts hairdressers among the qualifying hair and beauty salons, even where the shop works by appointment only; the council decides whether yours qualifies.',
        'On a single shop, small business rate relief means no rates to pay at £12,000 rateable value or below, with the relief tapering from 100% to 0% between £12,001 and £14,999; the council asks you to apply for it online. If the 2026 revaluation took away relief you had, its supporting small business relief limits the rise in your bill to £800 a year from 2026/27 to 2028/29 (or the transitional relief cap, if greater), applied without an application.',
      ],
      sourceIds: ['bccMultipliers', 'bccSmallBusiness', 'hmtRhlGuidance', 'govMultipliers'],
    },
    {
      id: 'mtd',
      title: 'Making Tax Digital',
      figure: '£30,000',
      figureLabel: 'qualifying income from 6 April 2027',
      body: [
        'Self-employed barbers, whether you rent a chair on Broad Street or own the shop as a sole trader, join Making Tax Digital for Income Tax on 6 April 2027 if your self-employment and property income is over £30,000 before expenses. From then you keep digital records and send HMRC an update every quarter from compatible software.',
        'The threshold falls to £20,000 in April 2028. Booking records help you see what came in, but KERSIVO is not tax software. General information, not tax advice; HMRC or an accountant can confirm your position.',
      ],
      sourceIds: ['govMtd'],
    },
    {
      id: 'cards',
      title: 'Card fees on deposits',
      figure: `${depositFee}p`,
      figureLabel: `Stripe’s standard fee on a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit, rounded`,
      body: [
        `Online deposits and payments run through your shop’s own Stripe account. At Stripe’s standard UK card rate of ${stripeRate}, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit costs about ${depositFee}p and a £${MIDDLE_FADE} fade paid in full about ${fullFadeFee}p; premium and non-UK cards cost more. On those payments KERSIVO itself takes 0% commission. ${STRIPE_FEES_NOTE}`,
        'Taking cards at the chair with a terminal is priced separately by whichever provider you use.',
      ],
      sourceIds: ['stripeUk'],
    },
  ],
  journey: {
    district: 'Moseley',
    near: 'Alcester Road',
    query: 'barber near me',
    shopName: 'Heritage Grooming',
    shopDomain: 'heritagegrooming.co.uk',
    service: 'Skin fade + beard trim',
    servicePrice: 32,
    slot: 'Fri 17:45',
    product: 'Beard oil',
    productPrice: 14,
    shelf: [
      { name: 'Matte clay', price: 13 },
      { name: 'Sea salt spray', price: 11 },
    ],
  },
  faqs: [
    {
      id: 'switch',
      question: 'I’m on Booksy or Fresha in Birmingham. How do I move without losing regulars?',
      answer: [
        'Run both for a short while. Keep your current listing live while we build your site, then switch the booking link on your Google Business Profile, Instagram and WhatsApp Business on one day, and mention it at the chair for a couple of weeks. Walk-ins keep walking in; it is the online bookings you are moving.',
        'Fresha lets you export your client list, and Booksy asks you to request yours from Booksy Support. We can help move eligible information exported from your current provider. Some history may not transfer. If students are a big part of your book, switching before the start of a term means they find the new link when they come back.',
      ],
    },
    {
      id: 'deposits',
      question: 'Should a Birmingham barbershop take deposits for Friday evening and Saturday chairs?',
      answer: [
        `If a no-show on a Friday after work or a Saturday morning costs you a cut you could have sold, a deposit is worth a look. Full KERSIVO has one payment setting for the whole shop, applied to every online booking: Pay at shop, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit (never more than the service price), or full payment online. You cannot set it for Fridays and Saturdays only.`,
        `On Birmingham’s £${MIDDLE_FADE} middle fade, a £${KERSIVO_BOOKING_DEPOSIT_GBP} deposit is a fifth of the price. It will not pay for the empty chair, but the client has committed money and you keep the deposit if they do not show. Deposits and online payment need your own Stripe account connected. ${STRIPE_FEES_NOTE}`,
      ],
    },
    {
      id: 'google',
      question: 'How do Birmingham barbershops get found on Google Maps across different postcodes?',
      answer: [
        'Google bases its local results mainly on relevance, distance and prominence, and you cannot pay to be ranked higher. Distance means a search in Erdington will mostly show shops near Erdington, so a shop on Soho Road is unlikely to top a search made in Moseley, however good its site is.',
        'What you control is how clearly Google can read your shop. Put your district, street and postcode on your website, list each service with its price, keep opening hours right on your Business Profile, and use your own domain for both the website and booking links. Reviews on your profile also help. Nobody can promise you a spot in the map results.',
      ],
    },
    {
      id: 'costs',
      question: 'Which 2026/27 business rates and Making Tax Digital rules apply to my Birmingham shop?',
      answer: [
        'Your bill comes from your rateable value and the multiplier Birmingham City Council applies. A barbershop that qualifies as retail, hospitality or leisure and sits below £51,000 rateable value uses the 38.2p multiplier; otherwise the small business figure is 43.2p. A single shop at £12,000 rateable value or less pays nothing with small business rate relief, which tapers away by £15,000.',
        'Separately, sole traders with self-employment and property income over £30,000 move to Making Tax Digital for Income Tax on 6 April 2027. This is general information, not advice; Birmingham City Council confirms your rates and HMRC or an accountant your tax.',
      ],
    },
    {
      id: 'price',
      question: 'How much is KERSIVO for a Birmingham barbershop compared with marketplace fees?',
      answer: [
        `Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location, the same flat price whether you run two chairs in Kings Heath or six off Colmore Row, with no setup fee and no VAT added. For that you get the website on your own domain, online booking that can take deposits, the retail pickup shop and booking reminders.`,
        `KERSIVO takes 0% commission on bookings and product sales. ${STRIPE_FEES_NOTE} Marketplace new-client fees are charged per booking instead, so on a £${MIDDLE_FADE} fade the calculator on this page shows how few new clients it takes to match £${SAAS_MONTHLY_GBP}. If you only need online booking for now, KERSIVO Starter is £0/month for up to 4 barbers.`,
      ],
    },
  ],
  sources: [
    {
      id: 'booksyBirminghamFade',
      label: 'Booksy: Skin Fade in Birmingham, England',
      url: 'https://booksy.com/en-gb/s/skin-fade/1276035_birmingham',
      supports:
        'the Birmingham skin fade range, middle price and B1–B5 split: our read of the list prices of the 15 barbershops with a stand-alone adult skin fade on the first results page (45 results listed); where a shop lists a full and a back-and-sides-only fade we used the full fade, and kids’ and student prices were left out',
      checkedIso: CHECKED,
    },
    {
      id: 'barberBoardPrices',
      label: 'The Barber Board: How much should a haircut cost in the UK?',
      url: 'https://thebarberboard.com/guides/how-much-should-a-haircut-cost-uk/',
      supports: 'the UK big-city skin fade range used for comparison, from about 150 UK price lists read on 28 September 2026',
      checkedIso: CHECKED,
      pageDate: 'updated 1 November 2026',
    },
    {
      id: 'trimcheckChairRent',
      label: 'TrimCheck: Rent a chair in a barbershop (UK)',
      url: 'https://trimcheck.com/chair-rental/',
      supports: 'the weekly, daily and split chair-rent band given for Manchester, Birmingham, Leeds and Glasgow, from public adverts sampled on 23 September 2026 and published industry ranges',
      checkedIso: CHECKED,
    },
    {
      id: 'bccMultipliers',
      label: 'Birmingham City Council: How we work out your business rates',
      url: 'https://www.birmingham.gov.uk/Multipliers',
      supports: 'the five business rates multipliers from 1 April 2026 and the 2026 revaluation',
      checkedIso: CHECKED,
      pageDate: 'updated 21 November 2025',
    },
    {
      id: 'bccSmallBusiness',
      label: 'Birmingham City Council: Reductions for small businesses',
      url: 'https://www.birmingham.gov.uk/info/20148/business_rates/252/business_rates_reductions/4',
      supports: 'small business rate relief thresholds and applying online, and the 2026 supporting small business relief £800 cap applied automatically',
      checkedIso: CHECKED,
      pageDate: 'updated 6 March 2026',
    },
    {
      id: 'hmtRhlGuidance',
      label: 'GOV.UK: Business Rates Multipliers: Qualifying Retail, Hospitality or Leisure',
      url: 'https://www.gov.uk/guidance/business-rates-multipliers-qualifying-retail-hospitality-or-leisure',
      supports: 'hairdressers as qualifying hair and beauty salons, including appointment-only premises',
      checkedIso: CHECKED,
      pageDate: 'updated 30 March 2026',
    },
    {
      id: 'govMultipliers',
      label: 'GOV.UK: Notification of non-domestic rating multipliers for 2026/27',
      url: 'https://www.gov.uk/government/publications/22026-notification-of-non-domestic-rating-multipliers-for-202627/22026-notification-of-non-domestic-rating-multipliers-for-202627',
      supports: 'the 2026/27 multipliers for England and the £51,000 small business threshold',
      checkedIso: CHECKED,
      pageDate: 'published 10 February 2026',
    },
    {
      id: 'govMtd',
      label: 'GOV.UK: Sole traders and landlords earning more than £30,000 urged to act now',
      url: 'https://www.gov.uk/government/news/sole-traders-and-landlords-earning-more-than-30000-urged-to-act-now',
      supports: 'Making Tax Digital for Income Tax from 6 April 2027 at £30,000 and the April 2028 threshold',
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
