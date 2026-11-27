/**
 * /self-employed-barber-tax-calculator: free browser tool for chair renters and other self-employed
 * barbers — Income Tax and Class 4 National Insurance for 2025/26 or 2026/27, what to put aside each
 * working week, the January and July payments and the Making Tax Digital test.
 * Copy, FAQ and JSON-LD live here so tests can assert them. Figures come from
 * src/data/self-employed-tax-rates.ts; defaults are example numbers, never UK averages.
 */
import {
  MAKING_TAX_DIGITAL_PHASES,
  PAYMENTS_ON_ACCOUNT,
  SELF_EMPLOYED_TAX_YEARS,
  TRADING_ALLOWANCE,
} from '@/data/self-employed-tax-rates';
import { DEFAULT_INPUTS, calculateTax } from '@/lib/barberTaxCalculator/engine';
import { formatGbp, formatPencePerPound, formatPercent } from '@/lib/barberTaxCalculator/view';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/kersivoEntityJsonLd';
import { INSIGHTS_MTD_BARBERS } from '@/lib/seo/insights';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export const BARBER_TAX_CALCULATOR_PAGE_PATH = '/self-employed-barber-tax-calculator';
export const BARBER_TAX_CALCULATOR_LAST_UPDATED_ISO = '2026-11-27';
export const BARBER_TAX_CALCULATOR_LAST_UPDATED_LABEL = '27 November 2026';
export const BARBER_TAX_CALCULATOR_BREADCRUMB_NAME = 'Self-employed barber tax calculator';
export const BARBER_TAX_CALCULATOR_TITLE = 'Self-Employed Barber Tax Calculator UK: What to Set Aside';
export const BARBER_TAX_CALCULATOR_DESCRIPTION =
  'For chair renters and self-employed barbers: your Income Tax and National Insurance, what to put aside each week and your January tax bill. Free.';
export const BARBER_TAX_CALCULATOR_H1 = 'Self-employed barber tax calculator';
export const BARBER_TAX_CALCULATOR_EYEBROW = 'Free tool · No sign-up';

const y2627 = SELF_EMPLOYED_TAX_YEARS['2026-27'];
const y2526 = SELF_EMPLOYED_TAX_YEARS['2025-26'];
const gbp = (value: number) => formatGbp(value);
const pct = (rate: number) => formatPercent(rate);

/** Direct answer under the H1 (40–60 words) for "self employed barber tax" searches. */
export const BARBER_TAX_CALCULATOR_DIRECT_ANSWER =
  'As a self-employed barber, you pay Income Tax and Class 4 National Insurance on your profit: what clients pay you, tips included, minus chair rent and other business costs. This free calculator works out the bill for 2026/27 or 2025/26, what to put aside each week and what is due on 31 January.';

export const BARBER_TAX_CALCULATOR_TRUST_SIGNALS: readonly string[] = [
  'Free, no account or email needed',
  '2025/26 and 2026/27 GOV.UK rates',
  'Nothing you type leaves your browser',
];

export const BARBER_TAX_FORM_COPY = {
  examples: 'Example numbers — replace them with your own.',
  yearLegend: 'Tax year and where you live',
  yearLabel: 'Tax year',
  regionLabel: 'Where you live',
  regionHelper: 'Scotland has its own Income Tax rates. National Insurance is the same across the UK.',
  takingsLegend: 'What you take',
  takingsLabel: 'What clients pay you in a typical week',
  takingsHelper: 'Cuts and other services, before chair rent. Leave tips out here.',
  tipsLabel: 'Tips you keep in a typical week',
  tipsHelper: 'Cash or card, tips are part of a self-employed barber’s income.',
  weeksLabel: 'Weeks you work in the year',
  weeksHelper: 'Leave out holidays and time off.',
  costsLegend: 'Your costs',
  rentLabel: 'Chair rent per week',
  rentWeeksLabel: 'Weeks you pay rent',
  rentWeeksHelper: 'Include holiday weeks if your agreement charges rent for them.',
  otherLabel: 'Other business costs per month',
  otherHelper: 'Products, tools, insurance, card fees, booking software, training and the business share of your phone.',
  moreLegend: 'If it applies',
  jobLabel: 'Pay from a job in the same tax year, before tax',
  jobHelper: 'Tax on it is usually taken through PAYE. Leave at 0 if you only work self-employed.',
  poaLabel: 'Payments on account already made for this tax year',
  poaHelper: 'Only if you paid HMRC in advance for this year, in January and July. Leave at 0 in your first year.',
} as const;

export const BARBER_TAX_RESULTS_COPY = {
  eyebrow: 'Your tax',
  heading: 'What to put aside',
  perWeekLabel: 'Each working week',
  perPoundLabel: 'Of every £1 clients pay you',
  breakdownLabel: 'How the bill is worked out',
  turnoverRow: 'Takings and tips',
  rentRow: 'Chair rent',
  otherRow: 'Other business costs',
  allowanceRow: 'Trading allowance',
  profitRow: 'Profit',
  incomeTaxRow: 'Income Tax',
  class4Row: 'Class 4 National Insurance',
  billRow: 'Tax bill for',
  takeHomeRow: 'Take-home after costs and tax',
  datesHeading: 'When to pay HMRC',
  copy: 'Copy summary',
  print: 'Print',
  priceLink: 'Check your prices still pay you after tax',
} as const;

export const BARBER_TAX_SCENARIOS_COPY = {
  eyebrow: 'Busier or quieter',
  heading: 'If you take more or less',
  lead: 'Your rent and costs stay the same when you are busier, so each extra pound of takings is profit, and taxed. Here is your bill with weekly takings 20% lower or higher.',
  takingsColumn: 'Weekly takings',
  billColumn: 'Tax bill',
  weekColumn: 'Per week',
} as const;

const mtdPhaseLines = MAKING_TAX_DIGITAL_PHASES.map(
  (phase) => `From ${phase.startsLabel}: takings and tips over ${gbp(phase.overGbp)} in ${phase.basedOnLabel}`,
);

export const BARBER_TAX_MTD_COPY = {
  eyebrow: 'Making Tax Digital',
  heading: 'Will you need Making Tax Digital?',
  lead: 'Making Tax Digital for Income Tax means keeping digital records and sending HMRC a summary every quarter. The test is your takings and tips before costs (plus any property income), not your profit.',
  phases: mtdPhaseLines,
  articleLabel: 'Making Tax Digital for barbers, explained',
  articleHref: INSIGHTS_MTD_BARBERS.path,
} as const;

/** "How to use it" steps; each one describes what the calculator already does. */
export const BARBER_TAX_HOW_TO_USE = {
  heading: 'How to use it',
  steps: [
    'Pick the tax year and where you live, then enter what clients pay you and the tips you keep in a typical week.',
    'Add your chair rent and other business costs, plus any job or payments on account, replacing the example numbers.',
    'Read what to put aside each working week and what is due in January and July, then copy or print the summary.',
  ],
} as const;

export const BARBER_TAX_METHOD = {
  heading: 'How the calculator works',
  steps: [
    {
      title: 'Takings and tips',
      body: 'What clients pay you each week plus the tips you keep, multiplied by the weeks you work. Tips you keep are part of your business income.',
    },
    {
      title: 'Costs',
      body: `Chair rent × the weeks you pay it, plus your other costs × 12. If your costs come to less than ${gbp(TRADING_ALLOWANCE.amountGbp)}, the ${gbp(TRADING_ALLOWANCE.amountGbp)} trading allowance is used instead.`,
    },
    {
      title: 'Income Tax',
      body: `Profit (plus any job pay) less the ${gbp(y2627.personalAllowanceGbp)} Personal Allowance, which shrinks by £1 for every £2 of income over ${gbp(y2627.personalAllowanceIncomeLimitGbp)}. The rest is taxed in the bands for your tax year: 20%, 40% and 45% in England, Wales and Northern Ireland, or the six Scottish rates from 19% to 48%. With a job, tax on its pay is assumed to be taken through PAYE, so only the extra tax goes on your bill.`,
    },
    {
      title: 'Class 4 National Insurance',
      body: `${pct(y2627.class4.mainRate)} of profit between ${gbp(y2627.class4.lowerProfitsLimitGbp)} and ${gbp(y2627.class4.upperProfitsLimitGbp)}, and ${pct(y2627.class4.additionalRate)} above. Class 2 is treated as paid when profit is ${gbp(y2627.class2.smallProfitsThresholdGbp)} or more in ${y2627.label} (${gbp(y2526.class2.smallProfitsThresholdGbp)} in ${y2526.label}).`,
    },
    {
      title: 'What to put aside',
      body: 'The tax bill ÷ the weeks you work, rounded up to the pound. “Of every £1” is the bill ÷ your takings and tips, rounded up to the penny.',
    },
    {
      title: 'Payments on account',
      body: `If the bill is ${gbp(PAYMENTS_ON_ACCOUNT.minimumBillGbp)} or more and no more than ${pct(PAYMENTS_ON_ACCOUNT.atSourceShare)} of your tax was paid through PAYE, HMRC asks for two advance payments towards next year, each half of this year’s bill, on 31 January and 31 July.`,
    },
  ],
  limits:
    'It leaves out student loan repayments, the High Income Child Benefit Charge, pension contributions and Gift Aid, savings, dividends, property income and capital allowances. HMRC’s own calculation on your return is the final word.',
} as const;

/** The example on the page, used in the FAQ so the answer always matches the calculator. */
const example = calculateTax(DEFAULT_INPUTS);

export type BarberTaxFaqItem = { question: string; answer: string };

export const BARBER_TAX_FAQ_ITEMS: readonly BarberTaxFaqItem[] = [
  {
    question: 'How much should a self-employed barber put aside for tax?',
    answer: `Work out your profit (takings and tips, less chair rent and other business costs) and the Income Tax and Class 4 National Insurance on it. On this calculator’s example of ${gbp(example.profit)} profit, the ${example.rates.label} bill is about ${gbp(example.bill)}: ${pct(example.shareOfProfit)} of profit, or ${formatPencePerPound(example.shareOfTurnover)} of every £1 clients pay. Your own figure depends on your profit and any other income.`,
  },
  {
    question: 'Is chair rent tax deductible for a self-employed barber?',
    answer: `Yes. Chair rent is a business cost, so it comes off your takings before tax, along with products, tools, insurance, card fees, booking software and training. If your costs come to less than ${gbp(TRADING_ALLOWANCE.amountGbp)} a year, you can use the ${gbp(TRADING_ALLOWANCE.amountGbp)} trading allowance instead.`,
  },
  {
    question: 'Do self-employed barbers pay tax on tips?',
    answer: 'Yes. Tips you receive and keep as a self-employed barber are part of your business income, cash or card, so they go in with your takings.',
  },
  {
    question: 'What is a payment on account?',
    answer: `An advance payment towards next year’s tax. If your bill is ${gbp(PAYMENTS_ON_ACCOUNT.minimumBillGbp)} or more, HMRC usually asks for two, each half of this year’s bill, on 31 January and 31 July. In your first year that makes January about one and a half times the bill. They are not needed if more than ${pct(PAYMENTS_ON_ACCOUNT.atSourceShare)} of your tax is already paid through PAYE.`,
  },
  {
    question: 'When do barbers have to use Making Tax Digital?',
    answer: `It depends on your takings and tips before costs, plus any property income. ${MAKING_TAX_DIGITAL_PHASES.map((phase) => `Over ${gbp(phase.overGbp)} in ${phase.basedOnLabel}: from ${phase.startsLabel}.`).join(' ')} You then keep digital records and send HMRC a summary every quarter.`,
  },
  {
    question: 'When is the Self Assessment deadline?',
    answer: `For ${y2526.label}, the online return and the tax are due by ${y2526.januaryDeadlineLabel}, with a second payment on account (if you make them) by ${y2526.julyDeadlineLabel}. If you started working self-employed in ${y2526.label}, you should have told HMRC by ${y2526.registerByLabel}.`,
  },
  {
    question: 'Is the calculator free, and is my data stored?',
    answer: 'It is free, with no account or email. Everything is worked out in your browser: nothing you type is sent to KERSIVO or stored.',
  },
];

export const BARBER_TAX_RELATED_LINKS: readonly { href: string; label: string; description: string }[] = [
  {
    href: '/barber-price-calculator',
    label: 'Barber price calculator',
    description: 'Check your prices still pay you once tax is put aside.',
  },
  {
    href: '/chair-rent-vs-commission-calculator',
    label: 'Chair rent vs commission calculator',
    description: 'Compare renting a chair with working on commission.',
  },
  {
    href: INSIGHTS_MTD_BARBERS.path,
    label: 'Making Tax Digital for barbers',
    description: 'Who is in from April 2027, what to record and the deadlines.',
  },
];

function pageUrl(siteUrl: string): string {
  return `${siteUrl}${BARBER_TAX_CALCULATOR_PAGE_PATH}`;
}

export function buildBarberTaxCalculatorJsonLd(): Record<string, unknown>[] {
  const siteUrl = getPublicSiteUrl();
  const url = pageUrl(siteUrl);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: BARBER_TAX_CALCULATOR_TITLE,
      description: BARBER_TAX_CALCULATOR_DESCRIPTION,
      inLanguage: 'en-GB',
      dateModified: BARBER_TAX_CALCULATOR_LAST_UPDATED_ISO,
      isPartOf: { '@id': getKersivoWebsiteId(siteUrl) },
      publisher: { '@id': getKersivoOrganizationId(siteUrl) },
      breadcrumb: { '@id': `${url}#breadcrumb` },
      mainEntity: { '@id': `${url}#tool` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `${url}#tool`,
      name: 'KERSIVO self-employed barber tax calculator',
      url,
      description:
        'Free browser-based calculator that works out a UK self-employed barber’s Income Tax and Class 4 National Insurance for 2025/26 or 2026/27, what to put aside each working week, the January and July payments and the Making Tax Digital test.',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web browser',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      provider: { '@id': getKersivoOrganizationId(siteUrl) },
      inLanguage: 'en-GB',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Free tools', item: `${siteUrl}/free-tools` },
        { '@type': 'ListItem', position: 3, name: BARBER_TAX_CALCULATOR_BREADCRUMB_NAME, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: BARBER_TAX_FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
}
