/**
 * /booksy-vs-fresha: neutral head-to-head for UK barbershops, with KERSIVO as a third option.
 * Every price comes from booksyFacts.ts / freshaFacts.ts; nothing is retyped here.
 */
import { KERSIVO_COMMISSION_WITH_STRIPE } from '@/lib/pricing/claimsPolicy';
import {
  BOOKSY_FACTS_CHECKED_DATE,
  BOOKSY_FACTS_CHECKED_ISO,
  BOOKSY_SOURCES,
  estimateBooksyBoostFee,
  estimateBooksyMonthlySubscription,
  requireVerifiedBooksyFact,
} from '@/lib/seo/booksyFacts';
import {
  FRESHA_FACTS_CHECKED_DATE,
  FRESHA_FACTS_CHECKED_ISO,
  FRESHA_SOURCES,
  estimateFreshaMarketplaceNewClientFee,
  estimateFreshaMonthlySubscription,
  requireVerifiedFreshaFact,
} from '@/lib/seo/freshaFacts';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const BOOKSY_VS_FRESHA_PAGE_PATH = '/booksy-vs-fresha';
export const BOOKSY_VS_FRESHA_LAST_UPDATED_ISO = '2026-11-15';
export const BOOKSY_VS_FRESHA_LAST_UPDATED_LABEL = '15 November 2026';
export const BOOKSY_VS_FRESHA_BREADCRUMB_NAME = 'Booksy vs Fresha';
export const BOOKSY_VS_FRESHA_TITLE = 'Booksy vs Fresha for UK Barbershops: Fees Compared | KERSIVO';
export const BOOKSY_VS_FRESHA_DESCRIPTION =
  'Booksy or Fresha for a UK barbershop? Monthly cost by team size, new-client fees, card fees and who each one suits, from official UK prices.';
export const BOOKSY_VS_FRESHA_H1 = 'Booksy vs Fresha for a UK barbershop';

/** Older of the two checked dates, shown as the page's data date. */
export const BOOKSY_VS_FRESHA_DATA_CHECKED =
  (FRESHA_FACTS_CHECKED_ISO ?? '') < BOOKSY_FACTS_CHECKED_ISO ? FRESHA_FACTS_CHECKED_DATE ?? '' : BOOKSY_FACTS_CHECKED_DATE;

function money(value: number): string {
  return Number.isInteger(value) ? `£${value}` : `£${value.toFixed(2)}`;
}

function rate(percent: number, fixedGbp: number): string {
  return `${percent}% + ${Math.round(fixedGbp * 100)}p`;
}

/* ----------------------------- Team-size costs ----------------------------- */

export const BVF_MAX_BARBERS = 10;

export type BvfCostRow = { barbers: number; booksy: number; fresha: number; kersivo: number };

export const BVF_COST_ROWS: readonly BvfCostRow[] = Array.from({ length: BVF_MAX_BARBERS }, (_, index) => {
  const barbers = index + 1;
  return {
    barbers,
    booksy: estimateBooksyMonthlySubscription(barbers).incVatGbp,
    fresha: estimateFreshaMonthlySubscription(barbers).incVatGbp,
    kersivo: SAAS_MONTHLY_GBP,
  };
});

/** Smallest team size at which Booksy's subscription is cheaper than Fresha's; null if never within range. */
export const BVF_CROSSOVER_BARBERS: number | null =
  BVF_COST_ROWS.find((row) => row.booksy < row.fresha)?.barbers ?? null;

export const BVF_COST_NOTE = `Subscription only, including 20% VAT, which both providers add to their UK prices (Booksy checked ${BOOKSY_FACTS_CHECKED_DATE}, Fresha ${FRESHA_FACTS_CHECKED_DATE}). Card fees, marketplace fees, SMS top-ups and add-ons are not included. Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location with no VAT added.`;

/* ------------------------------ Head-to-head ------------------------------ */

const booksyBase = requireVerifiedBooksyFact('baseSubscription');
const booksyUser = requireVerifiedBooksyFact('additionalUser');
const booksyBoost = requireVerifiedBooksyFact('boostNewClientFee');
const booksyMobile = requireVerifiedBooksyFact('mobilePayments');
const booksyTap = requireVerifiedBooksyFact('tapToPay');
const freshaIndependent = requireVerifiedFreshaFact('independentPlan');
const freshaTeam = requireVerifiedFreshaFact('teamPlanPerMember');
const freshaNewClient = requireVerifiedFreshaFact('marketplaceNewClientFee');
const freshaOnline = requireVerifiedFreshaFact('onlinePayments');
const freshaInPerson = requireVerifiedFreshaFact('inPersonPayments');
const freshaTapAuth = requireVerifiedFreshaFact('tapToPayAuthorisation');
const freshaSmartWebsite = requireVerifiedFreshaFact('smartWebsiteAddOn');

export const BVF_EXAMPLE_FIRST_VISIT_GBP = 25;
const booksyBoost25 = estimateBooksyBoostFee(BVF_EXAMPLE_FIRST_VISIT_GBP);
const freshaNewClient25 = estimateFreshaMarketplaceNewClientFee(BVF_EXAMPLE_FIRST_VISIT_GBP);

export type BvfRow = { topic: string; booksy: string; fresha: string };

export const BVF_ROWS: readonly BvfRow[] = [
  {
    topic: 'Pricing model',
    booksy: 'One base plan for the business, plus a fee for each additional user.',
    fresha: 'Per bookable team member, with a cheaper plan for a single person.',
  },
  {
    topic: 'Subscription',
    booksy: `${money(booksyBase.amountGbp!)}/month + VAT, plus ${money(booksyUser.amountGbp!)}/month + VAT per additional user.`,
    fresha: `${money(freshaIndependent.amountGbp!)}/month + VAT for one person, or ${money(freshaTeam.amountGbp!)}/month + VAT per team member.`,
  },
  {
    topic: 'New clients from the marketplace',
    booksy: `Free when Boost is off. With optional Boost: ${booksyBoost.percent}% of the first visit, minimum ${money(booksyBoost.minimumGbp!)}, + VAT (${money(booksyBoost25)} on a ${money(BVF_EXAMPLE_FIRST_VISIT_GBP)} cut).`,
    fresha: `${freshaNewClient.percent}% of the first visit, minimum ${money(freshaNewClient.minimumGbp!)}, + VAT, on a brand-new Marketplace client (${money(freshaNewClient25)} on a ${money(BVF_EXAMPLE_FIRST_VISIT_GBP)} cut).`,
  },
  {
    topic: 'Returning and direct clients',
    booksy: 'No commission on clients who book through your own link or profile.',
    fresha: 'No fee on returning clients or on bookings through your own booking links.',
  },
  {
    topic: 'Online card payments',
    booksy: `${rate(booksyMobile.percent!, booksyMobile.amountGbp!)} + VAT (Mobile Payments).`,
    fresha: `${rate(freshaOnline.percent!, freshaOnline.amountGbp!)} + VAT.`,
  },
  {
    topic: 'In-person card payments',
    booksy: `${rate(booksyTap.percent!, booksyTap.amountGbp!)} + VAT with Tap to Pay on a phone.`,
    fresha: `${rate(freshaInPerson.percent!, freshaInPerson.amountGbp!)} + VAT, plus ${Math.round(freshaTapAuth.amountGbp! * 100)}p per Tap to Pay authorisation.`,
  },
  {
    topic: 'Deposits and no-shows',
    booksy: 'Deposits and cancellation fees through No-Show Protection, with Mobile Payments.',
    fresha: 'Deposits, card capture and late-cancellation or no-show policies with Fresha Payments.',
  },
  {
    topic: 'Your own website',
    booksy: 'A booking widget you can add to an existing website.',
    fresha: `A Book button for your website; the optional Smart Website add-on is ${money(freshaSmartWebsite.amountGbp!)}/month.`,
  },
  {
    topic: 'Getting your client list out',
    booksy: 'Requested from Booksy Support.',
    fresha: 'Exported from the Fresha workspace.',
  },
];

/* --------------------------------- Verdict --------------------------------- */

const crossoverSentence =
  BVF_CROSSOVER_BARBERS === null
    ? `Fresha’s subscription is cheaper at every team size up to ${BVF_MAX_BARBERS} barbers.`
    : `Fresha’s subscription is cheaper up to ${BVF_CROSSOVER_BARBERS - 1} barbers; from ${BVF_CROSSOVER_BARBERS} barbers, Booksy’s is cheaper.`;

export const BVF_DIRECT_ANSWER = `${crossoverSentence} The bigger difference is new clients: Booksy charges nothing for Marketplace bookings unless you switch on Boost, while Fresha charges a one-off ${freshaNewClient.percent}% (minimum ${money(freshaNewClient.minimumGbp!)}) on every brand-new Marketplace client. If most of your clients are regulars who book you directly, neither marketplace fee matters much.`;

export const BVF_CHOOSE_BOOKSY: readonly string[] = [
  `You have ${BVF_CROSSOVER_BARBERS ?? BVF_MAX_BARBERS}+ barbers, where its base-plus-users pricing works out cheaper.`,
  'You want Marketplace exposure without a per-client fee, and can leave Boost off.',
  'Your clients already use the Booksy app and expect to find you there.',
];

export const BVF_CHOOSE_FRESHA: readonly string[] = [
  `You work alone or with a small team, where ${money(freshaIndependent.amountGbp!)} or ${money(freshaTeam.amountGbp!)} per person + VAT is the lower bill.`,
  'You expect only a few new clients a month from the Marketplace, so the one-off fee stays small.',
  'You want client lists you can export yourself from the workspace.',
];

export const BVF_NEITHER: readonly string[] = [
  'Most of your clients already find you through Google, Instagram, word of mouth or walking past.',
  'You want them to book on your own website and domain, under your shop’s name, not on a marketplace profile.',
  'You want one flat price per shop, so hiring another barber does not change the bill.',
];

export const BVF_KERSIVO_LINE = `Full KERSIVO is £${SAAS_MONTHLY_GBP}/month per location for your own branded website, domain and online booking. ${KERSIVO_COMMISSION_WITH_STRIPE} KERSIVO has no marketplace or customer app, so it does not bring you new clients the way Booksy or Fresha can.`;

/* ----------------------------------- FAQ ----------------------------------- */

export type BvfFaqItem = { question: string; answer: string };

export const BVF_FAQ_ITEMS: readonly BvfFaqItem[] = [
  { question: 'Is Booksy or Fresha cheaper for a barbershop?', answer: BVF_DIRECT_ANSWER },
  {
    question: 'Does Fresha charge commission on every booking?',
    answer: `No. Fresha charges a one-off ${freshaNewClient.percent}% fee (minimum ${money(freshaNewClient.minimumGbp!)}, + VAT) only on a brand-new client who finds you through the Fresha Marketplace. Returning clients and bookings through your own links are not charged.`,
  },
  {
    question: 'Does Booksy charge commission?',
    answer: `Only if you switch on Boost. Then Booksy charges ${booksyBoost.percent}% of a new Boost client’s first visit, minimum ${money(booksyBoost.minimumGbp!)}, + VAT. Standard Marketplace bookings are free when Boost is off.`,
  },
  {
    question: 'Which has lower card fees, Booksy or Fresha?',
    answer: `Online, Booksy lists ${rate(booksyMobile.percent!, booksyMobile.amountGbp!)} and Fresha ${rate(freshaOnline.percent!, freshaOnline.amountGbp!)}, both + VAT. In person, Booksy Tap to Pay is ${rate(booksyTap.percent!, booksyTap.amountGbp!)} and Fresha ${rate(freshaInPerson.percent!, freshaInPerson.amountGbp!)}, both + VAT.`,
  },
  {
    question: 'Is there an option without a marketplace?',
    answer: `Yes. KERSIVO is built for independent UK barbershops whose clients book them directly. ${BVF_KERSIVO_LINE}`,
  },
];

/* ---------------------------------- Sources --------------------------------- */

export type BvfSource = { provider: string; label: string; url: string; checked: string };

export const BVF_SOURCES: readonly BvfSource[] = [
  ...BOOKSY_SOURCES.filter((s) => ['pricingUk', 'boost', 'payments', 'tapToPay', 'noShowProtection', 'websiteWidget', 'clientList'].includes(s.id)).map(
    (s) => ({ provider: 'Booksy', label: s.label, url: s.url, checked: BOOKSY_FACTS_CHECKED_DATE }),
  ),
  ...FRESHA_SOURCES.filter((s) => ['pricingUk', 'marketplaceFee', 'bookingLinks', 'clientExport', 'paymentPolicies'].includes(s.id)).map(
    (s) => ({ provider: 'Fresha', label: s.label, url: s.url, checked: FRESHA_FACTS_CHECKED_DATE ?? '' }),
  ),
];

/* ---------------------------------- JSON-LD --------------------------------- */

export function buildBooksyVsFreshaJsonLd(): Record<string, unknown>[] {
  const siteUrl = getPublicSiteUrl();
  const url = `${siteUrl}${BOOKSY_VS_FRESHA_PAGE_PATH}`;
  const organization = { '@id': getKersivoOrganizationId(siteUrl) };
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: BOOKSY_VS_FRESHA_TITLE,
      headline: BOOKSY_VS_FRESHA_H1,
      description: BOOKSY_VS_FRESHA_DESCRIPTION,
      inLanguage: 'en-GB',
      dateModified: BOOKSY_VS_FRESHA_LAST_UPDATED_ISO,
      isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
      publisher: organization,
      author: organization,
      breadcrumb: { '@id': `${url}#breadcrumb` },
      about: [
        { '@type': 'SoftwareApplication', name: 'Booksy', applicationCategory: 'BusinessApplication' },
        { '@type': 'SoftwareApplication', name: 'Fresha', applicationCategory: 'BusinessApplication' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Compare', item: `${siteUrl}/compare` },
        { '@type': 'ListItem', position: 3, name: BOOKSY_VS_FRESHA_BREADCRUMB_NAME, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: BVF_FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
}
