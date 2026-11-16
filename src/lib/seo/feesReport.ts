/**
 * UK barber booking software fees report (/barber-booking-fees-uk).
 *
 * A citable, dated summary of published UK prices. Every figure is derived from the
 * competitor facts modules or the cost-calculator engine; nothing is typed by hand.
 * Update the edition and date when the facts files are re-checked.
 */
import { COST_SCENARIO_APPOINTMENTS_PER_BARBER, COST_SCENARIO_TABLES } from '@/lib/costCalculator/costScenarios';
import { NEW_CLIENT_FEE_ROWS, newClientFee } from '@/lib/compare/bestSoftwareData';
import { KERSIVO_COMMISSION_WITH_STRIPE } from '@/lib/pricing/claimsPolicy';
import { BOOKSY_FACTS_CHECKED_DATE, getBooksySource, requireVerifiedBooksyFact } from '@/lib/seo/booksyFacts';
import { FRESHA_FACTS_CHECKED_DATE, getFreshaSource, requireVerifiedFreshaFact } from '@/lib/seo/freshaFacts';
import { NEARCUT_FACTS_CHECKED_DATE, getNearcutSource } from '@/lib/seo/nearcutFacts';
import { PHOREST_FACTS_CHECKED_DATE, getPhorestSource } from '@/lib/seo/phorestFacts';
import { SETORA_FACTS_CHECKED_DATE, getSetoraSource } from '@/lib/seo/setoraFacts';
import { SQUARE_FACTS_CHECKED_DATE, SQUARE_SOURCES } from '@/lib/seo/squareFacts';
import { SQUIRE_FACTS_CHECKED_DATE, getSquireSource } from '@/lib/seo/squireFacts';
import {
  STRIPE_FACTS_CHECKED_DATE,
  STRIPE_SOURCE_UK_PRICING,
  STRIPE_UK_STANDARD_CARD_FIXED_GBP,
  STRIPE_UK_STANDARD_CARD_PERCENT,
} from '@/lib/seo/stripeFacts';
import { TIMELY_FACTS_CHECKED_DATE, getTimelySource, requireVerifiedTimelyFact } from '@/lib/seo/timelyFacts';
import { TREATWELL_FACTS_CHECKED_DATE, TREATWELL_SOURCES, requireVerifiedTreatwellFact } from '@/lib/seo/treatwellFacts';
import { VAGARO_FACTS_CHECKED_DATE, VAGARO_SOURCES, requireVerifiedVagaroFact } from '@/lib/seo/vagaroFacts';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const FEES_REPORT_PAGE_PATH = '/barber-booking-fees-uk';
export const FEES_REPORT_EDITION = 'Winter 2026/27 edition';
export const FEES_REPORT_PUBLISHED_ISO = '2026-11-15';
export const FEES_REPORT_LAST_UPDATED_ISO = '2026-11-15';
export const FEES_REPORT_LAST_UPDATED_LABEL = '15 November 2026';
export const FEES_REPORT_BREADCRUMB_NAME = 'Booking fees report';

export const FEES_REPORT_TITLE = 'Barber Booking Software Fees UK: 2026/27 Report | KERSIVO';
export const FEES_REPORT_DESCRIPTION =
  'What 10 booking systems charge a UK barbershop: monthly cost by team size, marketplace new-client fees and card fees, from official prices with dates.';
export const FEES_REPORT_H1 = 'What booking software costs a UK barbershop';
export const FEES_REPORT_EYEBROW = 'Fees report · ' + FEES_REPORT_EDITION;

const VAT_RATE = 0.2;
const EXAMPLE_PAYMENT_GBP = 25;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatReportGbp(value: number): string {
  return Number.isInteger(value) ? `£${value}` : `£${value.toFixed(2)}`;
}

/* ------------------------------ Monthly cost ------------------------------ */

export type ReportCostRow = {
  providerId: string;
  name: string;
  /** Monthly cash cost per team size, aligned with FEES_REPORT_TEAM_SIZES; null = quote needed. */
  monthly: readonly (number | null)[];
};

export const FEES_REPORT_TEAM_SIZES: readonly number[] = COST_SCENARIO_TABLES.map((table) => table.barbers);

const displayName = (id: string, name: string) => (id === 'kersivo' ? 'Full KERSIVO' : name);

export const FEES_REPORT_COST_ROWS: readonly ReportCostRow[] = COST_SCENARIO_TABLES[0].rows
  .map((row) => ({
    providerId: row.providerId,
    name: displayName(row.providerId, row.name),
    monthly: COST_SCENARIO_TABLES.map(
      (table) => table.rows.find((entry) => entry.providerId === row.providerId)?.monthlyGbp ?? null,
    ),
  }))
  .sort((a, b) => {
    const last = (row: ReportCostRow) => row.monthly[row.monthly.length - 1];
    const aLast = last(a);
    const bLast = last(b);
    if (aLast === null && bLast === null) return a.name.localeCompare(b.name);
    if (aLast === null) return 1;
    if (bLast === null) return -1;
    return aLast - bLast;
  });

export const FEES_REPORT_COST_NOTE = `Monthly cash cost for a shop that is not VAT registered, so VAT is included where a provider adds it. Direct bookings only: ${COST_SCENARIO_APPOINTMENTS_PER_BARBER} appointments a month per barber, no marketplace clients, no optional add-ons and no deposit processing. Nearcut shows its Free for You plan, where clients can pay a booking charge that is not in the shop’s total. Square shows its Free plan. Vagaro shows the price currently displayed on its UK pricing page. Full KERSIVO is shown; KERSIVO Starter is £0/month for up to 4 bookable barbers. “Quote” means the provider does not publish a price that can be calculated.`;

export const FEES_REPORT_QUOTE_ONLY: readonly string[] = FEES_REPORT_COST_ROWS.filter((row) =>
  row.monthly.every((value) => value === null),
).map((row) => row.name);

function costFor(providerId: string, sizeIndex: number): number {
  const value = FEES_REPORT_COST_ROWS.find((row) => row.providerId === providerId)?.monthly[sizeIndex];
  if (value === null || value === undefined) throw new Error(`No calculated cost for ${providerId}`);
  return value;
}

/* --------------------------- Marketplace fees ---------------------------- */

export const FEES_REPORT_NEW_CLIENT_PRICES: readonly number[] = [20, 25, 35];

export type ReportNewClientRow = {
  id: string;
  name: string;
  rate: string;
  when: string;
  /** Fee per first visit at each FEES_REPORT_NEW_CLIENT_PRICES value, as published (before VAT). */
  fees: readonly number[];
};

export const FEES_REPORT_NEW_CLIENT_ROWS: readonly ReportNewClientRow[] = NEW_CLIENT_FEE_ROWS.map((row) => ({
  id: row.id,
  name: row.name,
  rate:
    row.percent === 0
      ? '0%'
      : `${row.percent}%${row.minimumGbp > 0 ? `, minimum ${formatReportGbp(row.minimumGbp)}` : ''}`,
  when: row.when,
  fees: FEES_REPORT_NEW_CLIENT_PRICES.map((price) => newClientFee(row, price)),
}));

export const FEES_REPORT_NEW_CLIENT_NOTE =
  'Fees as published, before VAT where the provider adds it. They apply only to a qualifying new client found through each marketplace; repeat clients and clients who book through your own link are not charged this way. Card processing is separate.';

/* ------------------------------- Card fees ------------------------------- */

export type ReportCardVat = 'none' | 'added' | 'not-stated';

export type ReportCardRow = {
  id: string;
  name: string;
  channel: string;
  percent: number;
  fixedGbp: number;
  vat: ReportCardVat;
  /** Fee on EXAMPLE_PAYMENT_GBP, with VAT added where the provider adds it. */
  feeOnExample: number;
};

function cardRow(
  id: string,
  name: string,
  channel: string,
  percent: number,
  fixedGbp: number,
  vat: ReportCardVat,
): ReportCardRow {
  const base = (EXAMPLE_PAYMENT_GBP * percent) / 100 + fixedGbp;
  return {
    id,
    name,
    channel,
    percent,
    fixedGbp,
    vat,
    feeOnExample: round2(vat === 'added' ? base * (1 + VAT_RATE) : base),
  };
}

const booksyMobile = requireVerifiedBooksyFact('mobilePayments');
const freshaOnline = requireVerifiedFreshaFact('onlinePayments');
const timelyOnline = requireVerifiedTimelyFact('ukOnlinePaymentProcessing') as { percent: number; fixedGbp: number };
const vagaroPercent = requireVerifiedVagaroFact('standardOnlineProcessingPercent').value;
const vagaroFixed = requireVerifiedVagaroFact('standardOnlineProcessingFixedGbp').value;
const treatwellOnline = requireVerifiedTreatwellFact('onlinePrepaymentProcessing') as { percent: number };

export const FEES_REPORT_EXAMPLE_PAYMENT_GBP = EXAMPLE_PAYMENT_GBP;

export const FEES_REPORT_CARD_ROWS: readonly ReportCardRow[] = [
  cardRow('kersivo', 'KERSIVO via Stripe', 'Online deposit or full payment', STRIPE_UK_STANDARD_CARD_PERCENT, STRIPE_UK_STANDARD_CARD_FIXED_GBP, 'none'),
  cardRow('booksy', 'Booksy', 'Mobile Payments', booksyMobile.percent!, booksyMobile.amountGbp!, 'added'),
  cardRow('fresha', 'Fresha', 'Online payments', freshaOnline.percent!, freshaOnline.amountGbp!, 'added'),
  cardRow('vagaro', 'Vagaro', 'Keyed-in and online', vagaroPercent, vagaroFixed, 'not-stated'),
  cardRow('timely', 'Timely', 'TimelyPay, domestic UK online', timelyOnline.percent, timelyOnline.fixedGbp, 'not-stated'),
  cardRow('treatwell', 'Treatwell', 'Online prepayment', treatwellOnline.percent, 0, 'added'),
].sort((a, b) => a.feeOnExample - b.feeOnExample);

export const FEES_REPORT_CARD_NOT_PUBLISHED: readonly string[] = ['Phorest', 'SQUIRE'];

export const FEES_REPORT_CARD_NOTE = `Standard published rate for a UK card paid online. Premium and international cards can cost more on every platform. The fee on a ${formatReportGbp(EXAMPLE_PAYMENT_GBP)} payment includes VAT where the provider adds it; where VAT treatment is not stated, the published rate is shown as it is. Square’s online rate is published for its online payment products but not confirmed for appointment deposits, so it is left out. ${KERSIVO_COMMISSION_WITH_STRIPE}`;

export function formatCardRate(row: ReportCardRow): string {
  const percent = `${row.percent}%`;
  return row.fixedGbp > 0 ? `${percent} + ${Math.round(row.fixedGbp * 100)}p` : percent;
}

export const CARD_VAT_LABEL: Record<ReportCardVat, string> = {
  none: 'No VAT',
  added: '+ VAT',
  'not-stated': 'Not stated',
};

/* ------------------------------ Key findings ------------------------------ */

const lastIndex = FEES_REPORT_TEAM_SIZES.length - 1;
const smallest = FEES_REPORT_TEAM_SIZES[0];
const largest = FEES_REPORT_TEAM_SIZES[lastIndex];
const booksyFee25 = FEES_REPORT_NEW_CLIENT_ROWS.find((row) => row.id === 'booksy')!.fees[1];
const freshaFee25 = FEES_REPORT_NEW_CLIENT_ROWS.find((row) => row.id === 'fresha')!.fees[1];
const treatwellFee25 = FEES_REPORT_NEW_CLIENT_ROWS.find((row) => row.id === 'treatwell')!.fees[1];
const cheapestCard = FEES_REPORT_CARD_ROWS[0];
const priciestCard = FEES_REPORT_CARD_ROWS[FEES_REPORT_CARD_ROWS.length - 1];

export type ReportFinding = { figure: string; label: string; body: string };

export const FEES_REPORT_FINDINGS: readonly ReportFinding[] = [
  {
    figure: `${formatReportGbp(costFor('fresha', 0))} → ${formatReportGbp(costFor('fresha', lastIndex))}`,
    label: 'Per-barber pricing grows with the team',
    body: `Fresha goes from ${formatReportGbp(costFor('fresha', 0))} a month for ${smallest === 1 ? 'a solo barber' : `${smallest} barbers`} to ${formatReportGbp(costFor('fresha', lastIndex))} for ${largest} barbers. Booksy goes from ${formatReportGbp(costFor('booksy', 0))} to ${formatReportGbp(costFor('booksy', lastIndex))}. Per-location prices (Setora, Full KERSIVO) stay the same at any team size.`,
  },
  {
    figure: `${formatReportGbp(treatwellFee25)}`,
    label: 'Highest new-client fee on a £25 cut',
    body: `On a £25 first visit, the published marketplace fee is ${formatReportGbp(treatwellFee25)} on Treatwell, ${formatReportGbp(freshaFee25)} on Fresha and ${formatReportGbp(booksyFee25)} on Booksy when Boost brings the client, each before VAT. Clients who book through the shop’s own link are not charged this way.`,
  },
  {
    figure: `${formatReportGbp(cheapestCard.feeOnExample)}–${formatReportGbp(priciestCard.feeOnExample)}`,
    label: `Card fee on a ${formatReportGbp(EXAMPLE_PAYMENT_GBP)} online payment`,
    body: `On a standard UK card, the fee runs from ${formatReportGbp(cheapestCard.feeOnExample)} (${cheapestCard.name}, ${formatCardRate(cheapestCard)}) to ${formatReportGbp(priciestCard.feeOnExample)} (${priciestCard.name}, ${formatCardRate(priciestCard)}), with VAT included where the provider adds it. Phorest and SQUIRE do not publish a UK rate that can be compared.`,
  },
  {
    figure: `${FEES_REPORT_QUOTE_ONLY.length} of ${FEES_REPORT_COST_ROWS.length}`,
    label: 'Systems that need a quote',
    body: `${FEES_REPORT_QUOTE_ONLY.join(', ')} do not publish a monthly price that can be calculated for a UK barbershop. Free plans exist too (Square Free, Nearcut Free for You, KERSIVO Starter), each with its own limits.`,
  },
];

const highestMonthly = Math.max(
  ...FEES_REPORT_COST_ROWS.flatMap((row) => row.monthly.filter((value): value is number => value !== null)),
);

export const FEES_REPORT_DIRECT_ANSWER = `On published UK prices, booking software costs a barbershop from £0 (free plans) up to ${formatReportGbp(highestMonthly)} a month for ${largest} barbers in this report, before card fees. Per-barber plans (Booksy, Fresha, Vagaro) cost more as the team grows; per-location plans stay flat; marketplaces add a one-off fee on new clients they bring.`;

/* -------------------------------- Sources -------------------------------- */

export type ReportSource = { provider: string; checked: string; label: string; url: string };

export const FEES_REPORT_SOURCES: readonly ReportSource[] = [
  { provider: 'Booksy', checked: BOOKSY_FACTS_CHECKED_DATE, label: 'Booksy UK pricing', url: getBooksySource('pricingUk').url },
  { provider: 'Booksy', checked: BOOKSY_FACTS_CHECKED_DATE, label: 'Booksy Boost', url: getBooksySource('boost').url },
  { provider: 'Fresha', checked: FRESHA_FACTS_CHECKED_DATE ?? '', label: 'Fresha UK pricing', url: getFreshaSource('pricingUk').url },
  { provider: 'Treatwell', checked: TREATWELL_FACTS_CHECKED_DATE, label: 'Treatwell partner pricing', url: TREATWELL_SOURCES.find((s) => s.id === 'pricingUk')!.url },
  { provider: 'Vagaro', checked: VAGARO_FACTS_CHECKED_DATE, label: 'Vagaro UK pricing', url: VAGARO_SOURCES.find((s) => s.id === 'pricingUk')!.url },
  { provider: 'Vagaro', checked: VAGARO_FACTS_CHECKED_DATE, label: 'Vagaro UK card-processing rates', url: VAGARO_SOURCES.find((s) => s.id === 'ukCardFees')!.url },
  { provider: 'Timely', checked: TIMELY_FACTS_CHECKED_DATE, label: 'Timely pricing', url: getTimelySource('pricing').url },
  { provider: 'Timely', checked: TIMELY_FACTS_CHECKED_DATE, label: 'TimelyPay fees', url: getTimelySource('ukPayments').url },
  { provider: 'Setora', checked: SETORA_FACTS_CHECKED_DATE, label: 'Setora pricing', url: getSetoraSource('pricing').url },
  { provider: 'Square', checked: SQUARE_FACTS_CHECKED_DATE, label: 'Square Appointments UK pricing', url: SQUARE_SOURCES[0].url },
  { provider: 'Nearcut', checked: NEARCUT_FACTS_CHECKED_DATE, label: 'Nearcut UK pricing', url: getNearcutSource('pricingUk').url },
  { provider: 'Phorest', checked: PHOREST_FACTS_CHECKED_DATE, label: 'Phorest UK pricing', url: getPhorestSource('pricing').url },
  { provider: 'SQUIRE', checked: SQUIRE_FACTS_CHECKED_DATE, label: 'SQUIRE pricing', url: getSquireSource('pricing').url },
  { provider: 'Stripe', checked: STRIPE_FACTS_CHECKED_DATE, label: 'Stripe UK pricing', url: STRIPE_SOURCE_UK_PRICING },
];

export const FEES_REPORT_METHODOLOGY: readonly string[] = [
  'Prices come only from each provider’s official UK pricing page or Help Centre. The date each one was checked is listed under Sources.',
  'Monthly costs are calculated by the same engine as the KERSIVO barber software cost calculator, for a shop that is not VAT registered and takes direct bookings only.',
  'Where a provider does not publish a price (quote-only plans, unpublished card rates), the cell says so instead of estimating.',
  'KERSIVO sells booking software, so this is not an independent ranking. The figures are reproducible from the linked sources.',
];

export const FEES_REPORT_CITATION = `KERSIVO, “What booking software costs a UK barbershop: fees report”, ${FEES_REPORT_EDITION}, updated ${FEES_REPORT_LAST_UPDATED_LABEL}. https://kersivo.co.uk${FEES_REPORT_PAGE_PATH}`;

/* ---------------------------------- FAQ ---------------------------------- */

export type ReportFaqItem = { question: string; answer: string };

export const FEES_REPORT_FAQ_ITEMS: readonly ReportFaqItem[] = [
  {
    question: 'How much does barber booking software cost in the UK?',
    answer: FEES_REPORT_DIRECT_ANSWER,
  },
  {
    question: 'Which barber booking systems charge per barber?',
    answer: `Booksy (base plan plus each additional user), Fresha (per bookable team member) and Vagaro (per bookable calendar) price by team size. For ${largest} barbers that is ${formatReportGbp(costFor('booksy', lastIndex))} a month on Booksy and ${formatReportGbp(costFor('fresha', lastIndex))} on Fresha in this report’s example. Setora and Full KERSIVO charge per location.`,
  },
  {
    question: 'What do marketplaces charge for a new client?',
    answer: `On a £25 first visit: Treatwell ${formatReportGbp(treatwellFee25)}, Fresha ${formatReportGbp(freshaFee25)}, Booksy ${formatReportGbp(booksyFee25)} when optional Boost brings the client, each before VAT. The fee is one-off and applies only to qualifying new marketplace clients.`,
  },
  {
    question: 'Can I use these figures in an article?',
    answer: `Yes. Please cite the report and link to this page: ${FEES_REPORT_CITATION} Check the provider’s own page before publishing, because prices change.`,
  },
  {
    question: 'How often is the report updated?',
    answer: 'Each quarter, and sooner when a provider changes a published price. Every figure carries the date it was last checked.',
  },
];

/* -------------------------------- JSON-LD -------------------------------- */

function reportUrl(siteUrl: string): string {
  return `${siteUrl}${FEES_REPORT_PAGE_PATH}`;
}

export function buildFeesReportJsonLd(): Record<string, unknown>[] {
  const siteUrl = getPublicSiteUrl();
  const url = reportUrl(siteUrl);
  const organization = { '@id': getKersivoOrganizationId(siteUrl) };
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Report',
      '@id': `${url}#report`,
      url,
      headline: FEES_REPORT_H1,
      name: FEES_REPORT_TITLE,
      description: FEES_REPORT_DESCRIPTION,
      inLanguage: 'en-GB',
      datePublished: FEES_REPORT_PUBLISHED_ISO,
      dateModified: FEES_REPORT_LAST_UPDATED_ISO,
      version: FEES_REPORT_EDITION,
      author: organization,
      publisher: organization,
      isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
      breadcrumb: { '@id': `${url}#breadcrumb` },
      about: 'Booking software fees for UK barbershops',
      isAccessibleForFree: true,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      '@id': `${url}#dataset`,
      name: 'UK barber booking software fees',
      description:
        'Monthly cost by team size, marketplace new-client fees and online card fees for UK barber booking systems, from official UK pricing pages.',
      url,
      creator: organization,
      dateModified: FEES_REPORT_LAST_UPDATED_ISO,
      spatialCoverage: { '@type': 'Place', name: 'United Kingdom' },
      isAccessibleForFree: true,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      citation: FEES_REPORT_CITATION,
      isBasedOn: FEES_REPORT_SOURCES.map((source) => source.url),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Compare', item: `${siteUrl}/compare` },
        { '@type': 'ListItem', position: 3, name: FEES_REPORT_BREADCRUMB_NAME, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: FEES_REPORT_FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
}
