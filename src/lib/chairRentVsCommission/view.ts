/**
 * Display layer shared by the server render and the browser script, so the page
 * shows the same text with or without JavaScript. Rounds only here.
 */
import {
  STATUTORY_ANNUAL_LEAVE,
  UK_RATES_CHECKED_LABEL,
  UK_RATES_TAX_YEAR,
} from '@/data/uk-rates-2026-27';
import type { ComparisonResult } from './engine';

const wholePounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const penceFormat = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole pounds; avoids "-£0" for tiny negatives. */
export function formatGbp(value: number): string {
  const rounded = Math.round(value);
  return wholePounds.format(rounded === 0 ? 0 : rounded).replace('-', '−');
}

export function formatGbpPence(value: number): string {
  return penceFormat.format(value).replace('-', '−');
}

/** Cost lines are shown as negative amounts. */
const cost = (value: number) => (Math.round(value) === 0 ? formatGbp(0) : `−${formatGbp(Math.abs(value))}`);

export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export const WAGE_BAND_LABELS = {
  '21-plus': '21 and over',
  '18-20': '18 to 20',
  'under-18': 'Under 18',
  apprentice: 'Apprentice',
} as const;

export function verdictText(result: ComparisonResult): string {
  const amount = formatGbp(Math.abs(result.difference));
  if (result.verdict === 'same') return 'On these numbers, commission and chair rent leave the shop about the same.';
  if (result.verdict === 'commission') return `On these numbers, commission leaves the shop about ${amount} a year more than chair rent.`;
  return `On these numbers, chair rent leaves the shop about ${amount} a year more than commission.`;
}

export function breakEvenRentText(result: ComparisonResult): string {
  if (result.breakEvenWeeklyRent === null) return 'Enter the weeks rent is paid to see the break-even rent.';
  if (result.breakEvenWeeklyRent <= 0) return 'Commission leaves the shop nothing on these numbers, so any chair rent beats it.';
  return `Chair rent would need to be about ${formatGbp(result.breakEvenWeeklyRent)} a week to match commission.`;
}

export function breakEvenCommissionText(result: ComparisonResult): string {
  const rent = formatGbp(result.inputs.weeklyRentGbp);
  if (result.breakEvenCommissionPercent !== null) {
    return `Commission would need to be about ${formatPercent(result.breakEvenCommissionPercent)} to match a ${rent} weekly rent.`;
  }
  if (result.breakEvenCommissionOutOfRange === 'below-zero') {
    return `Even at 0% commission, employing a barber leaves the shop less than a ${rent} weekly rent.`;
  }
  return `Even at 100% commission, employing a barber leaves the shop more than a ${rent} weekly rent.`;
}

export function minimumWageWarningText(result: ComparisonResult): string {
  const typicalNeedsTopUp = result.commission.months.some((month) => month.kind === 'typical' && month.count > 0 && month.topUp > 0);
  if (!typicalNeedsTopUp) return 'Commission alone falls below the minimum wage in quiet months. The shop must top it up.';
  return `Commission alone falls below the minimum wage in ${result.commission.monthsNeedingTopUp} months of the year. The shop must top it up.`;
}

export const RESULTS_DISCLAIMER = `Estimates based on the numbers you entered, using ${UK_RATES_TAX_YEAR} rates checked ${UK_RATES_CHECKED_LABEL}. Not tax, legal or employment advice — check your arrangements with an accountant or employment adviser.`;

export type ResultView = {
  text: Record<string, string>;
  hidden: Record<string, boolean>;
};

export function buildResultView(result: ComparisonResult): ResultView {
  const { commission: a, rent: b, inputs } = result;
  const minimumMonths = a.months.filter((month) => month.count > 0);
  const quiet = a.months.find((month) => month.kind === 'quiet' && month.count > 0);

  const text: Record<string, string> = {
    'a-yearly': formatGbp(a.shopResult),
    'a-monthly': formatGbp(a.shopResult / 12),
    'a-takings': formatGbp(a.annualNetTakings),
    'a-commission': cost(a.commission),
    'a-holiday': cost(a.holidayPay),
    'a-topups': cost(a.topUps),
    'a-ni': cost(a.employerNi),
    'a-ni-note':
      a.employmentAllowanceUsed > 0
        ? `after ${formatGbp(a.employmentAllowanceUsed)} Employment Allowance`
        : a.niThreshold === 'standard'
          ? 'no Employment Allowance applied'
          : a.niThreshold === 'under-21'
            ? 'under-21 relief applied'
            : 'apprentice under-25 relief applied',
    'a-pension': cost(a.pension),
    'a-products': cost(a.products),
    'a-cardfees': cost(a.cardFees),
    'a-software': cost(a.software),
    'b-yearly': formatGbp(b.shopResult),
    'b-monthly': formatGbp(b.shopResult / 12),
    'b-rent': formatGbp(b.rentIncome),
    'b-extra': cost(b.extraCosts),
    verdict: verdictText(result),
    'be-rent': breakEvenRentText(result),
    'be-commission': breakEvenCommissionText(result),
    'mw-months': `${a.monthsNeedingTopUp} of 12`,
    'mw-topups': formatGbp(a.topUps),
    'mw-takings': a.breakEvenMonthlyTakings === null ? 'None at 0%' : `${formatGbp(a.breakEvenMonthlyTakings)} a month`,
    'mw-floor': `${formatGbpPence(a.monthlyFloor)} a month`,
    'mw-floor-note': `${a.monthlyHours.toFixed(1)} hours × ${formatGbpPence(a.hourlyMinimum)} (${WAGE_BAND_LABELS[inputs.wageBand].toLowerCase()})`,
    'mw-warning-text': minimumWageWarningText(result),
    'mw-typical-hourly':
      minimumMonths[0]?.effectiveHourly == null ? '—' : formatGbpPence(minimumMonths[0].effectiveHourly),
    'mw-quiet-hourly': quiet?.effectiveHourly == null ? '—' : formatGbpPence(quiet.effectiveHourly),
    'barber-employed': formatGbp(a.grossPay),
    'barber-renter': formatGbp(b.renterProfitBeforeTax),
    'barber-renter-rent': formatGbp(b.rentPaidByRenter),
  };

  result.sensitivity.forEach((row, index) => {
    text[`sens-${index}-a`] = formatGbp(row.commissionShop);
    text[`sens-${index}-b`] = formatGbp(row.rentShop);
    text[`sens-${index}-diff`] = formatGbp(row.commissionShop - row.rentShop);
  });

  return {
    text,
    hidden: {
      'row-holiday': !inputs.includeHolidayPay,
      'row-topups': a.topUps <= 0,
      'row-pension': !inputs.pensionEnrolled,
      'row-software': a.software <= 0,
      'row-extra': b.extraCosts <= 0,
      'row-quiet-hourly': !quiet,
      'mw-warning': a.topUps <= 0,
      'vat-note': !result.showVatNote,
      'barber-side': !inputs.showBarberSide,
    },
  };
}

export function buildSummaryText(result: ComparisonResult, pageUrl: string): string {
  const view = buildResultView(result).text;
  const { inputs, commission: a } = result;
  const lines = [
    'Chair Rent vs Commission — one chair, per year',
    `Chair takings (as paid by clients): ${formatGbp(a.annualGrossTakings)}`,
    '',
    `Employed on commission (${formatPercent(inputs.commissionPercent)}, ${WAGE_BAND_LABELS[inputs.wageBand].toLowerCase()}): shop keeps ${view['a-yearly']}`,
    `  Barber pay ${formatGbp(a.grossPay)} incl. ${formatGbp(a.topUps)} minimum wage top-ups${inputs.includeHolidayPay ? ` and ${formatGbp(a.holidayPay)} holiday pay (${STATUTORY_ANNUAL_LEAVE.weeks} weeks)` : ''}`,
    `  Employer NI ${formatGbp(a.employerNi)}, pension ${formatGbp(a.pension)}`,
    `Chair rental (${formatGbp(inputs.weeklyRentGbp)} × ${inputs.rentWeeksPerYear} weeks): shop keeps ${view['b-yearly']}`,
    '',
    view.verdict,
    view['be-rent'],
    view['be-commission'],
    `Minimum wage: ${view['mw-months']} months need a top-up (${view['mw-topups']} a year).`,
  ];
  if (inputs.showBarberSide) {
    lines.push(`Barber: employed gross pay ${view['barber-employed']}; renter profit before tax ${view['barber-renter']}.`);
  }
  lines.push('', RESULTS_DISCLAIMER, pageUrl);
  return lines.join('\n');
}
