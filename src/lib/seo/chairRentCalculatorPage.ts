import {
  AUTO_ENROLMENT_PENSION,
  EMPLOYER_NATIONAL_INSURANCE,
  EMPLOYMENT_ALLOWANCE,
  EMPLOYMENT_STATUS_CHECK,
  STATUTORY_ANNUAL_LEAVE,
  UK_RATES_CHECKED_LABEL,
  UK_RATES_TAX_YEAR,
  VAT,
  WEEKS_PER_YEAR,
} from '@/data/uk-rates-2026-27';
import { INSIGHTS_COMMISSION_PAY, INSIGHTS_OWNER_EARNINGS } from '@/lib/seo/insights';
import { BARBER_COST_CALCULATOR_PAGE_PATH } from '@/lib/seo/barberCostCalculatorPage';

/**
 * Visible copy and SEO metadata for /chair-rent-vs-commission-calculator.
 * Statutory figures are interpolated from src/data/uk-rates-2026-27.ts. Defaults are example numbers, never UK averages.
 */

export const CHAIR_RENT_CALCULATOR_PAGE_PATH = '/chair-rent-vs-commission-calculator';
export const CHAIR_RENT_CALCULATOR_TITLE = 'Chair Rent vs Commission Calculator for UK Barbers';
export const CHAIR_RENT_CALCULATOR_DESCRIPTION =
  "Compare renting a chair with paying an employed barber commission. See your shop's profit, break-even rent, minimum wage top-ups and employer costs.";
export const CHAIR_RENT_CALCULATOR_BREADCRUMB_NAME = 'Chair Rent vs Commission Calculator';
export const CHAIR_RENT_CALCULATOR_APP_NAME = 'Chair Rent vs Commission Calculator';

/** Visible "Last updated" date; also used for sitemap lastmod and WebPage dateModified. */
export const CHAIR_RENT_CALCULATOR_LAST_UPDATED_ISO = '2026-10-29';
export const CHAIR_RENT_CALCULATOR_LAST_UPDATED_LABEL = '29 October 2026';

export const CHAIR_RENT_CALCULATOR_OG_IMAGE = '/images/og/chair-rent-vs-commission-calculator-1200x630.png';
export const CHAIR_RENT_CALCULATOR_OG_IMAGE_ALT = 'Chair rent or commission? Run the numbers. KERSIVO calculator for UK barbershops.';

const pct = (rate: number) => `${Math.round(rate * 1000) / 10}%`;
const gbp = (value: number) => `£${value.toLocaleString('en-GB')}`;

export const OWNER_EARNINGS_CHAIR_RENT_SECTION = `${INSIGHTS_OWNER_EARNINGS.path}#employed-barbers-commission-or-chair-rent-do-not-mix-the-accounts`;
export const OWNER_EARNINGS_VAT_SECTION = `${INSIGHTS_OWNER_EARNINGS.path}#first-what-counts-as-a-barbershop-owners-earnings`;
export const COMMISSION_ARTICLE_PATH = INSIGHTS_COMMISSION_PAY.path;
export const COMMISSION_ARTICLE_WORKED_EXAMPLE = `${INSIGHTS_COMMISSION_PAY.path}#a-worked-example-one-barber-three-months`;

/* ---------------------------------- Hero ---------------------------------- */

export const CHAIR_RENT_HERO = {
  eyebrow: 'FREE TOOL FOR UK BARBERSHOP OWNERS',
  title: 'Chair Rent vs Commission Calculator',
  lead:
    'For one chair, compare what your shop keeps in a year from an employed barber on commission with what it keeps from a self-employed barber renting the chair.',
  supporting: `Includes minimum wage top-ups in quiet months, holiday pay, employer’s National Insurance, pension and VAT, using ${UK_RATES_TAX_YEAR} rates.`,
  examples: 'Example numbers — replace them with your own.',
  privacy: 'Everything is worked out in your browser. Nothing is stored or sent.',
} as const;

/* ---------------------------------- Form ---------------------------------- */

export const FORM_COPY = {
  chairLegend: 'The chair',
  commissionLegend: 'A — Employed barber on commission',
  rentLegend: 'B — Self-employed chair renter',
  commissionTab: 'A: Commission',
  rentTab: 'B: Chair rent',
  employmentAllowanceHelper: 'Not every employer qualifies, and the allowance is shared across your whole payroll.',
  rentVatHelper: 'Check the VAT treatment of chair rental with your accountant.',
  hoursHelper: 'Hours they must be at work or available, including quiet time with no client in the chair.',
  monthlyHoursHelper: `Leave at 0 to work it out from weekly hours (× ${WEEKS_PER_YEAR} ÷ 12, or only the weeks not on leave when holiday pay is on).`,
  apprenticeHelper: `Employer’s NI is 0% up to ${gbp(EMPLOYER_NATIONAL_INSURANCE.apprenticeUnderTwentyFiveUpperThresholdAnnualGbp)} for apprentices under 25. Under-21s get the same relief automatically.`,
  tipsNote: 'Tips never count towards the minimum wage, so they are left out.',
  barberSide: 'Show the barber’s side',
} as const;

/* --------------------------------- Results -------------------------------- */

export const RESULTS_COPY = {
  heading: 'Your results for one chair',
  commissionCard: 'Employed on commission',
  rentCard: 'Chair rental',
  yearly: 'Shop’s yearly result',
  perMonth: 'per month',
  breakEvenHeading: 'Break-even',
  minimumWageHeading: 'Minimum wage check',
  minimumWageLink: 'How the minimum wage works with commission',
  sensitivityHeading: 'If the chair takes more or less',
  sensitivityNote: 'Rent is fixed whatever the chair takes; commission rises and falls with takings.',
  barberHeading: 'The barber’s side',
  barberNote: `Employment also brings paid holiday (${STATUTORY_ANNUAL_LEAVE.weeks} weeks), employer pension contributions and eligibility for Statutory Sick Pay. Both figures are before Income Tax and National Insurance, which work differently for employees and the self-employed.`,
  vatNote:
    'A genuine renter’s takings are the renter’s, not your shop’s turnover, so they don’t count towards your VAT threshold the way an employed barber’s takings do. This is general information, not advice.',
  vatLink: 'VAT and turnover in the owner earnings model',
  copy: 'Copy summary',
  print: 'Print',
  share: 'Copy share link',
} as const;

/* ------------------------------ Employment status ------------------------------ */

export const STATUS_SECTION = {
  heading: 'Is your renter genuinely self-employed?',
  body:
    'Calling an arrangement chair rental doesn’t make it self-employment. Status depends on how it works in practice. If a ‘renter’ is really working like an employee, the shop can end up responsible for employment rights, tax and National Insurance.',
  selfEmployedHeading: 'Signs that usually point towards genuine self-employment:',
  selfEmployed: [
    'They set their own prices and hours.',
    'They take and keep their own clients’ payments.',
    'They supply their own tools and products.',
    'They can choose how the work is done.',
    'They bear their own business risk.',
  ],
  employeeHeading: 'Signs that point the other way:',
  employee: [
    'The shop sets the rota and prices.',
    'Takings go through the shop’s till.',
    'The shop decides how the work is done.',
    'The barber can’t send someone else or work elsewhere.',
  ],
  cestLabel: `GOV.UK: ${EMPLOYMENT_STATUS_CHECK.label}`,
  cestHref: EMPLOYMENT_STATUS_CHECK.source,
  articleLabel: 'Employed barbers, commission or chair rent: do not mix the accounts',
  articleHref: OWNER_EARNINGS_CHAIR_RENT_SECTION,
} as const;

/* --------------------------------- Method --------------------------------- */

export const METHOD_SECTION = {
  heading: 'How this calculator works',
  steps: [
    {
      title: 'Takings',
      body: 'Yearly takings are your typical month for the busy part of the year plus your quiet months at the percentage you enter, all as paid by clients.',
    },
    {
      title: 'VAT',
      body: `If the shop is VAT registered, an employed barber’s takings are shop turnover, so the calculator removes ${pct(VAT.standardRate)} VAT before working out the shop’s income. You can choose whether commission is paid on takings including or excluding VAT.`,
    },
    {
      title: 'Minimum wage, month by month',
      body: 'Each typical and quiet month is checked on its own: commission is compared with the hours the barber must be at work or available, multiplied by the minimum wage for their age band. Any shortfall is a top-up the shop pays. Tips never count.',
    },
    {
      title: 'Holiday pay (a simplification)',
      body: `With holiday pay on, the barber is at work for ${WEEKS_PER_YEAR - STATUTORY_ANNUAL_LEAVE.weeks} weeks and the calculator adds ${STATUTORY_ANNUAL_LEAVE.weeks} weeks of paid leave at their average weekly pay over those weeks. Real holiday pay for variable pay uses a 52-week reference period of weeks actually worked, so payroll figures will differ.`,
    },
    {
      title: 'Employer’s National Insurance and allowance',
      body: `${pct(EMPLOYER_NATIONAL_INSURANCE.rate)} on yearly pay above ${gbp(EMPLOYER_NATIONAL_INSURANCE.secondaryThresholdAnnualGbp)}. For employees under 21, and apprentices under 25, employer’s NI is 0% up to ${gbp(EMPLOYER_NATIONAL_INSURANCE.underTwentyOneUpperThresholdAnnualGbp)}. If you can claim Employment Allowance (up to ${gbp(EMPLOYMENT_ALLOWANCE.maxAnnualGbp)} a year across your payroll), enter the amount left for this barber.`,
    },
    {
      title: 'Pension',
      body: `If the barber is in a workplace pension, the employer’s minimum ${pct(AUTO_ENROLMENT_PENSION.employerMinimumRate)} is charged on qualifying earnings between ${gbp(AUTO_ENROLMENT_PENSION.qualifyingEarningsLowerAnnualGbp)} and ${gbp(AUTO_ENROLMENT_PENSION.qualifyingEarningsUpperAnnualGbp)}.`,
    },
    {
      title: 'Shop costs vs rent income',
      body: 'Under commission the shop pays for products, card fees and booking software for the chair. Under chair rent the shop keeps the rent (excluding any VAT it passes to HMRC) less any extra costs it covers, and the renter pays their own costs.',
    },
  ],
  articlesIntro: 'The same rules and figures are explained in two KERSIVO Insights articles:',
} as const;

/* -------------------------------- Trade-offs -------------------------------- */

export const TRADE_OFFS_SECTION = {
  heading: 'Commission or chair rent: the trade-offs',
  commissionHeading: 'Employing on commission',
  commission: [
    'More control and consistency: you set the rota, standards and prices, and client records stay with the shop.',
    'You share the upside when the barber is busy.',
    'You carry the minimum wage, holiday pay, employer’s NI, pension and other employment obligations.',
  ],
  rentHeading: 'Renting out the chair',
  rent: [
    'A fixed, predictable income and less payroll admin.',
    'Rent is protected when the chair is quiet, but doesn’t rise when it’s busy.',
    'Less say over how the chair is run, and a status risk if the arrangement works like employment.',
  ],
} as const;

/* ----------------------------------- CTA ----------------------------------- */

/**
 * KERSIVO has one Stripe Connect account per shop (ShopSettings), not per barber,
 * so this block makes no claim about renters taking their own payments.
 */
export const CHAIR_RENT_CTA = {
  heading: 'Bookings for every chair in your shop',
  body: 'KERSIVO Starter is £0/month for up to 4 active bookable barbers. Full KERSIVO is £39/month per location with unlimited barbers (fair use), your own website and domain. 0% KERSIVO commission; Stripe fees apply.',
  primary: { label: 'See KERSIVO Starter', href: '/starter' },
  secondary: { label: 'Compare plans', href: '/pricing' },
} as const;

/* ------------------------------- Related links ------------------------------- */

export const RELATED_LINKS = [
  {
    label: INSIGHTS_OWNER_EARNINGS.headline,
    href: INSIGHTS_OWNER_EARNINGS.path,
    description: 'A model profit and loss for UK barbershops, chair by chair.',
  },
  {
    label: INSIGHTS_COMMISSION_PAY.headline,
    href: INSIGHTS_COMMISSION_PAY.path,
    description: 'Minimum wage rates, hours and pay reference periods for employed barbers.',
  },
  {
    label: 'Barber Software Cost Calculator',
    href: BARBER_COST_CALCULATOR_PAGE_PATH,
    description: 'Compare booking software costs with your shop’s numbers.',
  },
] as const;

export const RATES_FOOTNOTE = `${UK_RATES_TAX_YEAR} rates checked ${UK_RATES_CHECKED_LABEL} on GOV.UK and The Pensions Regulator.`;
