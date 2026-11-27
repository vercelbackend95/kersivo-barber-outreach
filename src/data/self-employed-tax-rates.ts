/**
 * Income Tax and National Insurance for self-employed barbers, for the two tax years a barber
 * is dealing with at once: the year just ended (2025/26, return and payment due 31 January 2027)
 * and the year they are earning in now (2026/27). Single source of truth for the
 * Self-Employed Barber Tax Calculator: no rate, band or date may be hard-coded anywhere else in that tool.
 *
 * Income Tax bands are stored as GOV.UK publishes them in the "current and past" table:
 * taxable income, i.e. income after the Personal Allowance has been deducted.
 * Every entry carries the official page it was read from and the date it was checked.
 */
import type { RateSource } from './uk-rates-2026-27';

/** Date every figure below was last re-read on its official page (ISO). */
export const SELF_EMPLOYED_RATES_CHECKED_ISO = '2026-11-27';
export const SELF_EMPLOYED_RATES_CHECKED_LABEL = '27 November 2026';

export const TAX_YEARS = ['2026-27', '2025-26'] as const;
export type TaxYear = (typeof TAX_YEARS)[number];

export const TAX_REGIONS = ['england-wales-ni', 'scotland'] as const;
export type TaxRegion = (typeof TAX_REGIONS)[number];

export type IncomeTaxBand = {
  readonly name: string;
  readonly rate: number;
  /** Upper limit of taxable income (after the Personal Allowance) for this band; null = no upper limit. */
  readonly upToTaxableGbp: number | null;
};

export type TaxYearRates = {
  readonly id: TaxYear;
  /** "2026/27" */
  readonly label: string;
  /** "2027/28": the year the payments on account made after this year's return are for. */
  readonly nextLabel: string;
  readonly startIso: string;
  readonly endIso: string;
  readonly personalAllowanceGbp: number;
  /** The Personal Allowance goes down by £1 for every £2 of adjusted net income above this. */
  readonly personalAllowanceIncomeLimitGbp: number;
  readonly incomeTaxBands: Readonly<Record<TaxRegion, readonly IncomeTaxBand[]>>;
  readonly class4: {
    readonly lowerProfitsLimitGbp: number;
    readonly upperProfitsLimitGbp: number;
    readonly mainRate: number;
    readonly additionalRate: number;
  };
  readonly class2: {
    /** At or above this profit, Class 2 is treated as paid; below it, Class 2 is voluntary. */
    readonly smallProfitsThresholdGbp: number;
    readonly voluntaryWeeklyGbp: number;
  };
  /** Online return and payment of the bill (plus the first payment on account for the next year). */
  readonly januaryDeadlineIso: string;
  readonly januaryDeadlineLabel: string;
  /** Second payment on account for the next year. */
  readonly julyDeadlineIso: string;
  readonly julyDeadlineLabel: string;
  /** Deadline to tell HMRC you need to file for this year if you are new to Self Assessment. */
  readonly registerByLabel: string;
};

const ENGLAND_WALES_NI_BANDS: readonly IncomeTaxBand[] = [
  { name: 'Basic rate', rate: 0.2, upToTaxableGbp: 37_700 },
  { name: 'Higher rate', rate: 0.4, upToTaxableGbp: 125_140 },
  { name: 'Additional rate', rate: 0.45, upToTaxableGbp: null },
];

export const SELF_EMPLOYED_TAX_YEARS: Readonly<Record<TaxYear, TaxYearRates>> = {
  '2026-27': {
    id: '2026-27',
    label: '2026/27',
    nextLabel: '2027/28',
    startIso: '2026-04-06',
    endIso: '2027-04-05',
    personalAllowanceGbp: 12_570,
    personalAllowanceIncomeLimitGbp: 100_000,
    incomeTaxBands: {
      'england-wales-ni': ENGLAND_WALES_NI_BANDS,
      scotland: [
        { name: 'Starter rate', rate: 0.19, upToTaxableGbp: 3_967 },
        { name: 'Basic rate', rate: 0.2, upToTaxableGbp: 16_956 },
        { name: 'Intermediate rate', rate: 0.21, upToTaxableGbp: 31_092 },
        { name: 'Higher rate', rate: 0.42, upToTaxableGbp: 62_430 },
        { name: 'Advanced rate', rate: 0.45, upToTaxableGbp: 125_140 },
        { name: 'Top rate', rate: 0.48, upToTaxableGbp: null },
      ],
    },
    class4: { lowerProfitsLimitGbp: 12_570, upperProfitsLimitGbp: 50_270, mainRate: 0.06, additionalRate: 0.02 },
    class2: { smallProfitsThresholdGbp: 7_105, voluntaryWeeklyGbp: 3.65 },
    januaryDeadlineIso: '2028-01-31',
    januaryDeadlineLabel: '31 January 2028',
    julyDeadlineIso: '2028-07-31',
    julyDeadlineLabel: '31 July 2028',
    registerByLabel: '5 October 2027',
  },
  '2025-26': {
    id: '2025-26',
    label: '2025/26',
    nextLabel: '2026/27',
    startIso: '2025-04-06',
    endIso: '2026-04-05',
    personalAllowanceGbp: 12_570,
    personalAllowanceIncomeLimitGbp: 100_000,
    incomeTaxBands: {
      'england-wales-ni': ENGLAND_WALES_NI_BANDS,
      scotland: [
        { name: 'Starter rate', rate: 0.19, upToTaxableGbp: 2_827 },
        { name: 'Basic rate', rate: 0.2, upToTaxableGbp: 14_921 },
        { name: 'Intermediate rate', rate: 0.21, upToTaxableGbp: 31_092 },
        { name: 'Higher rate', rate: 0.42, upToTaxableGbp: 62_430 },
        { name: 'Advanced rate', rate: 0.45, upToTaxableGbp: 125_140 },
        { name: 'Top rate', rate: 0.48, upToTaxableGbp: null },
      ],
    },
    class4: { lowerProfitsLimitGbp: 12_570, upperProfitsLimitGbp: 50_270, mainRate: 0.06, additionalRate: 0.02 },
    class2: { smallProfitsThresholdGbp: 6_845, voluntaryWeeklyGbp: 3.5 },
    januaryDeadlineIso: '2027-01-31',
    januaryDeadlineLabel: '31 January 2027',
    julyDeadlineIso: '2027-07-31',
    julyDeadlineLabel: '31 July 2027',
    registerByLabel: '5 October 2026',
  },
};

export const INCOME_TAX_RATES_SOURCE: RateSource = {
  source: 'https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past',
  checked: SELF_EMPLOYED_RATES_CHECKED_ISO,
};

export const SCOTTISH_INCOME_TAX_SOURCE: RateSource = {
  source: 'https://www.gov.uk/scottish-income-tax',
  checked: SELF_EMPLOYED_RATES_CHECKED_ISO,
};

export const SELF_EMPLOYED_NI_SOURCE: RateSource = {
  source: 'https://www.gov.uk/self-employed-national-insurance-rates',
  checked: SELF_EMPLOYED_RATES_CHECKED_ISO,
};

export const NI_RATES_PAST_SOURCE: RateSource = {
  source: 'https://www.gov.uk/government/publications/rates-and-allowances-national-insurance-contributions/rates-and-allowances-national-insurance-contributions',
  checked: SELF_EMPLOYED_RATES_CHECKED_ISO,
};

/** Payments on account: two advance payments, each half of last year's bill, due 31 January and 31 July. */
export const PAYMENTS_ON_ACCOUNT = {
  /** Not required if last year's bill was less than this. */
  minimumBillGbp: 1_000,
  /** Not required if more than this share of last year's tax was paid outside Self Assessment (e.g. PAYE). */
  atSourceShare: 0.8,
  source: 'https://www.gov.uk/understand-self-assessment-bill/payments-on-account',
  checked: SELF_EMPLOYED_RATES_CHECKED_ISO,
} as const;

export const SELF_ASSESSMENT_DEADLINES_SOURCE: RateSource = {
  source: 'https://www.gov.uk/self-assessment-tax-returns/deadlines',
  checked: SELF_EMPLOYED_RATES_CHECKED_ISO,
};

/** Up to £1,000 of trading income a year is tax-free; it can be claimed instead of actual expenses. */
export const TRADING_ALLOWANCE = {
  amountGbp: 1_000,
  source: 'https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income',
  checked: SELF_EMPLOYED_RATES_CHECKED_ISO,
} as const;

/**
 * Making Tax Digital for Income Tax. Qualifying income is total self-employment and property
 * income before expenses (turnover), taken from the tax return for the year shown.
 */
export const MAKING_TAX_DIGITAL_PHASES = [
  { startsIso: '2026-04-06', startsLabel: '6 April 2026', overGbp: 50_000, basedOn: '2024-25', basedOnLabel: '2024/25' },
  { startsIso: '2027-04-06', startsLabel: '6 April 2027', overGbp: 30_000, basedOn: '2025-26', basedOnLabel: '2025/26' },
  { startsIso: '2028-04-06', startsLabel: '6 April 2028', overGbp: 20_000, basedOn: '2026-27', basedOnLabel: '2026/27' },
] as const;

export const MAKING_TAX_DIGITAL_SOURCE = {
  source: 'https://www.gov.uk/guidance/check-if-youre-eligible-for-making-tax-digital-for-income-tax',
  qualifyingIncomeSource: 'https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax',
  checked: SELF_EMPLOYED_RATES_CHECKED_ISO,
} as const;

export const SELF_EMPLOYED_RATE_SOURCES: Readonly<Record<string, RateSource>> = {
  incomeTax: INCOME_TAX_RATES_SOURCE,
  scottishIncomeTax: SCOTTISH_INCOME_TAX_SOURCE,
  selfEmployedNi: SELF_EMPLOYED_NI_SOURCE,
  niRatesPast: NI_RATES_PAST_SOURCE,
  paymentsOnAccount: PAYMENTS_ON_ACCOUNT,
  deadlines: SELF_ASSESSMENT_DEADLINES_SOURCE,
  tradingAllowance: TRADING_ALLOWANCE,
  makingTaxDigital: MAKING_TAX_DIGITAL_SOURCE,
};
