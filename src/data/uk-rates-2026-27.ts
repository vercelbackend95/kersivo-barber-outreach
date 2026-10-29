/**
 * UK statutory rates for the 2026/27 tax year (England, Wales, Scotland and Northern Ireland
 * share these payroll figures). Single source of truth for the Chair Rent vs Commission
 * Calculator: no statutory figure may be hard-coded anywhere else in that tool.
 *
 * Every entry carries the official page it was read from and the date it was checked.
 * The same figures appear in the published Insights articles on commission pay,
 * owner earnings and apprentice costs.
 */

export type RateSource = {
  readonly source: string;
  readonly checked: string;
};

export const UK_RATES_TAX_YEAR = '2026/27';

/** Date every figure below was last re-read on its official page (ISO). */
export const UK_RATES_CHECKED_ISO = '2026-10-28';
export const UK_RATES_CHECKED_LABEL = '28 October 2026';

export const MINIMUM_WAGE_BANDS = ['21-plus', '18-20', 'under-18', 'apprentice'] as const;
export type MinimumWageBand = (typeof MINIMUM_WAGE_BANDS)[number];

/** National Minimum Wage / National Living Wage hourly rates from 1 April 2026. */
export const NATIONAL_MINIMUM_WAGE = {
  effectiveFrom: '2026-04-01',
  hourlyGbp: {
    '21-plus': 12.71,
    '18-20': 10.85,
    'under-18': 8.0,
    apprentice: 8.0,
  } satisfies Record<MinimumWageBand, number>,
  source: 'https://www.gov.uk/national-minimum-wage-rates',
  checked: UK_RATES_CHECKED_ISO,
} as const;

/** Employer (secondary) Class 1 National Insurance. */
export const EMPLOYER_NATIONAL_INSURANCE = {
  rate: 0.15,
  secondaryThresholdAnnualGbp: 5_000,
  /** Upper secondary threshold: 0% employer NI below it for employees under 21. */
  underTwentyOneUpperThresholdAnnualGbp: 50_270,
  /** Apprentice upper secondary threshold: 0% employer NI below it for apprentices under 25. */
  apprenticeUnderTwentyFiveUpperThresholdAnnualGbp: 50_270,
  source: 'https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027',
  checked: UK_RATES_CHECKED_ISO,
} as const;

export const EMPLOYMENT_ALLOWANCE = {
  maxAnnualGbp: 10_500,
  source: 'https://www.gov.uk/claim-employment-allowance',
  checked: UK_RATES_CHECKED_ISO,
} as const;

/** Automatic enrolment: qualifying earnings band and employer minimum contribution. */
export const AUTO_ENROLMENT_PENSION = {
  qualifyingEarningsLowerAnnualGbp: 6_240,
  qualifyingEarningsUpperAnnualGbp: 50_270,
  employerMinimumRate: 0.03,
  source:
    'https://www.thepensionsregulator.gov.uk/employers/new-employers/im-an-employer-who-has-to-provide-a-pension/declare-your-compliance/ongoing-duties-for-employers/earnings-thresholds',
  contributionSource: 'https://www.gov.uk/workplace-pensions/what-you-your-employer-and-the-government-pay',
  checked: UK_RATES_CHECKED_ISO,
} as const;

export const VAT = {
  standardRate: 0.2,
  registrationThresholdGbp: 90_000,
  source: 'https://www.gov.uk/vat-rates',
  thresholdSource: 'https://www.gov.uk/register-for-vat',
  checked: UK_RATES_CHECKED_ISO,
} as const;

export const STATUTORY_ANNUAL_LEAVE = {
  weeks: 5.6,
  source: 'https://www.gov.uk/holiday-entitlement-rights',
  checked: UK_RATES_CHECKED_ISO,
} as const;

/** Weeks in a year used for annualising weekly figures. */
export const WEEKS_PER_YEAR = 52;

export const EMPLOYMENT_STATUS_CHECK = {
  label: 'Check employment status for tax (CEST)',
  source: 'https://www.gov.uk/guidance/check-employment-status-for-tax',
  checked: UK_RATES_CHECKED_ISO,
} as const;

export const UK_RATE_SOURCES: Readonly<Record<string, RateSource>> = {
  nationalMinimumWage: NATIONAL_MINIMUM_WAGE,
  employerNationalInsurance: EMPLOYER_NATIONAL_INSURANCE,
  employmentAllowance: EMPLOYMENT_ALLOWANCE,
  autoEnrolmentPension: AUTO_ENROLMENT_PENSION,
  vat: VAT,
  statutoryAnnualLeave: STATUTORY_ANNUAL_LEAVE,
  employmentStatusCheck: EMPLOYMENT_STATUS_CHECK,
};
