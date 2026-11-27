/**
 * Display layer shared by the server render and the browser script, so the page shows the
 * same text with or without JavaScript. All rounding happens here.
 */
import {
  MAKING_TAX_DIGITAL_PHASES,
  PAYMENTS_ON_ACCOUNT,
  SELF_EMPLOYED_RATES_CHECKED_LABEL,
  TRADING_ALLOWANCE,
  type TaxRegion,
} from '@/data/self-employed-tax-rates';
import { VAT } from '@/data/uk-rates-2026-27';
import type { BarberTaxResult } from './engine';

const wholePounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const pence = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole pounds; avoids "-£0" for tiny negatives. */
export function formatGbp(value: number): string {
  const rounded = Math.round(value);
  return wholePounds.format(rounded === 0 ? 0 : rounded).replace('-', '−');
}

export function formatGbpPence(value: number): string {
  return pence.format(value);
}

/** Money to put aside is rounded up to the next pound, so rounding never leaves you short. */
export function formatSetAside(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return wholePounds.format(Math.ceil(Math.max(0, value) - 1e-9));
}

/** Cost lines are shown as negative amounts. */
const cost = (value: number) => (Math.round(value) === 0 ? formatGbp(0) : `−${formatGbp(Math.abs(value))}`);

/** "9p": pence of every £1 clients pay, rounded up. */
export function formatPencePerPound(share: number): string {
  return `${Math.ceil(Math.max(0, share) * 100 - 1e-9)}p`;
}

export function formatPercent(share: number): string {
  const rounded = Math.round(share * 1000) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export const TAX_YEAR_OPTIONS = [
  { value: '2026-27', label: '2026/27', hint: 'This tax year' },
  { value: '2025-26', label: '2025/26', hint: 'Due 31 January 2027' },
] as const;

export const REGION_LABELS: Readonly<Record<TaxRegion, string>> = {
  'england-wales-ni': 'England, Wales or NI',
  scotland: 'Scotland',
};

const mtdPhase = (basedOn: string) => MAKING_TAX_DIGITAL_PHASES.find((phase) => phase.basedOn === basedOn)!;
const MTD_2027 = mtdPhase('2025-26');
const MTD_2028 = mtdPhase('2026-27');

export function makingTaxDigitalText(result: BarberTaxResult): string {
  const turnover = formatGbp(result.turnover);
  const intro = `Your takings and tips for ${result.rates.label} come to ${turnover}`;
  switch (result.makingTaxDigital) {
    case 'from-april-2027':
      return `${intro}, over the ${formatGbp(MTD_2027.overGbp)} test. On these numbers you’ll need to use Making Tax Digital for Income Tax from ${MTD_2027.startsLabel}.`;
    case 'from-april-2028': {
      const earlier = result.makingTaxDigitalMayStart2027
        ? ` If your ${MTD_2027.basedOnLabel} takings and tips were also over ${formatGbp(MTD_2027.overGbp)}, you start on ${MTD_2027.startsLabel}.`
        : '';
      return `${intro}, over the ${formatGbp(MTD_2028.overGbp)} test. On these numbers you’ll need to use Making Tax Digital for Income Tax from ${MTD_2028.startsLabel} at the latest.${earlier}`;
    }
    default:
      return result.inputs.taxYear === '2025-26'
        ? `${intro}, under the ${formatGbp(MTD_2027.overGbp)} test that decides who starts on ${MTD_2027.startsLabel}. For ${MTD_2028.basedOnLabel} the test drops to ${formatGbp(MTD_2028.overGbp)}.`
        : `${intro}, under the ${formatGbp(MTD_2028.overGbp)} test that decides who starts on ${MTD_2028.startsLabel}.`;
  }
}

export function januaryDetailText(result: BarberTaxResult): string {
  const { rates, inputs } = result;
  const bill = formatGbp(result.bill);
  if (result.bill < 0.5 && inputs.paymentsOnAccountPaidGbp <= 0) {
    return `Nothing to pay for ${rates.label} on these numbers. You may still need to send a tax return.`;
  }
  const billPart =
    inputs.paymentsOnAccountPaidGbp <= 0
      ? `Your ${rates.label} bill of ${bill}`
      : result.overpaid > 0
        ? `Nothing more for ${rates.label}: you paid ${formatGbp(result.overpaid)} more on account than the bill, which you should get back or have set against what you owe`
        : `The rest of your ${rates.label} bill: ${bill} less ${formatGbp(inputs.paymentsOnAccountPaidGbp)} already paid on account`;
  switch (result.paymentsOnAccount) {
    case 'required':
      return `${billPart}, plus the first payment on account for ${rates.nextLabel} (${formatGbp(result.paymentOnAccountEach)}).`;
    case 'bill-under-minimum':
      return `${billPart}. No payments on account for ${rates.nextLabel}, because the bill is under ${formatGbp(PAYMENTS_ON_ACCOUNT.minimumBillGbp)}.`;
    default:
      return `${billPart}. No payments on account for ${rates.nextLabel}, because more than ${formatPercent(PAYMENTS_ON_ACCOUNT.atSourceShare)} of your tax was paid through PAYE.`;
  }
}

function incomeTaxNote(result: BarberTaxResult): string {
  const parts: string[] = [];
  if (result.inputs.region === 'scotland') parts.push('Scottish rates');
  if (result.inputs.employmentIncomeGbp > 0) parts.push('on top of the tax on your job');
  return parts.join(', ');
}

export const RESULTS_DISCLAIMER = `Estimates from the numbers you entered, using 2025/26 and 2026/27 GOV.UK rates checked ${SELF_EMPLOYED_RATES_CHECKED_LABEL}. Leaves out student loan repayments, the High Income Child Benefit Charge, pension contributions, savings, dividends and property income. Not tax advice: check your figures with an accountant or HMRC.`;

export type ResultView = {
  text: Record<string, string>;
  hidden: Record<string, boolean>;
};

export function buildResultView(result: BarberTaxResult): ResultView {
  const { rates, inputs } = result;
  const text: Record<string, string> = {
    'per-week': formatSetAside(result.perWorkingWeek),
    'per-pound': formatPencePerPound(result.shareOfTurnover),
    'per-month': formatSetAside(result.perMonth),
    'year-label': rates.label,
    turnover: formatGbp(result.turnover),
    'chair-rent': cost(result.chairRent),
    'other-costs': cost(result.otherCosts),
    allowance: cost(result.deduction),
    profit: formatGbp(result.profit),
    'income-tax': formatGbp(result.incomeTax),
    'income-tax-note': incomeTaxNote(result),
    class4: formatGbp(result.class4),
    bill: formatGbp(result.bill),
    'share-of-profit': formatPercent(result.shareOfProfit),
    'take-home': formatGbp(result.takeHome),
    'take-home-month': `${formatGbp(result.takeHome / 12)} a month`,
    'jan-date': rates.januaryDeadlineLabel,
    'jan-amount': formatGbp(result.januaryDue),
    'jan-detail': januaryDetailText(result),
    'jul-date': rates.julyDeadlineLabel,
    'jul-amount': formatGbp(result.julyDue),
    'jul-detail': `Second payment on account for ${rates.nextLabel}.`,
    'first-year-note': `First year paying tax this way? January asks for the whole ${rates.label} bill and half of next year’s in advance, so it is about one and a half times the bill.`,
    'class2-note': `Your profit is under ${formatGbp(rates.class2.smallProfitsThresholdGbp)}, so Class 2 National Insurance is not treated as paid. You can choose to pay it voluntarily (${formatGbpPence(rates.class2.voluntaryWeeklyGbp)} a week, about ${formatGbp(result.class2VoluntaryYearly)} a year) to keep your National Insurance record, which counts towards the State Pension.`,
    'allowance-note': `Your costs are under ${formatGbp(TRADING_ALLOWANCE.amountGbp)}, so the ${formatGbp(TRADING_ALLOWANCE.amountGbp)} trading allowance is used instead of them.`,
    'loss-note': `Your costs are ${formatGbp(result.loss)} more than your takings and tips, so there is no tax on your barbering for ${rates.label}. Ask an accountant whether the loss can be used against other income.`,
    'vat-note': `Your takings are over the ${formatGbp(VAT.registrationThresholdGbp)} VAT registration threshold. Check whether you need to register for VAT.`,
    'mtd-status': makingTaxDigitalText(result),
  };

  result.scenarios.forEach((row, index) => {
    text[`sc-${index}-takings`] = formatGbp(row.weeklyTakingsGbp);
    text[`sc-${index}-bill`] = formatGbp(row.bill);
    text[`sc-${index}-week`] = formatSetAside(row.perWorkingWeek);
  });

  return {
    text,
    hidden: {
      'row-other-costs': result.usesTradingAllowance,
      'row-chair-rent': result.usesTradingAllowance,
      'row-allowance': !result.usesTradingAllowance,
      'row-july': result.paymentsOnAccount !== 'required',
      'first-year-note': !(result.paymentsOnAccount === 'required' && inputs.paymentsOnAccountPaidGbp <= 0),
      'class2-note': result.class2Status === 'treated-as-paid' || result.profit <= 0,
      'allowance-note': !result.usesTradingAllowance,
      'loss-note': result.loss <= 0,
      'vat-note': !result.vatThresholdExceeded,
      'income-tax-note': incomeTaxNote(result) === '',
    },
  };
}

/** One sentence for the live region after an edit. */
export function announceText(result: BarberTaxResult): string {
  const view = buildResultView(result).text;
  return `Put aside ${view['per-week']} a working week. Your ${result.rates.label} tax bill: about ${view.bill}. Due ${view['jan-date']}: ${view['jan-amount']}.`;
}

export function buildSummaryText(result: BarberTaxResult, pageUrl: string): string {
  const view = buildResultView(result).text;
  const { inputs, rates } = result;
  const lines = [
    `Self-employed barber tax — ${rates.label}, ${REGION_LABELS[inputs.region]}`,
    `Takings and tips: ${view.turnover} (${inputs.weeksWorked} weeks)`,
    result.usesTradingAllowance ? `Trading allowance: ${view.allowance}` : `Chair rent: ${view['chair-rent']}; other costs: ${view['other-costs']}`,
    `Profit: ${view.profit}`,
    `Income Tax: ${view['income-tax']}; Class 4 National Insurance: ${view.class4}`,
    `Tax bill: ${view.bill} (${view['share-of-profit']} of profit)`,
    '',
    `Put aside: ${view['per-week']} a working week (${view['per-pound']} of every £1 clients pay)`,
    `${view['jan-date']}: ${view['jan-amount']}. ${view['jan-detail']}`,
  ];
  if (result.paymentsOnAccount === 'required') lines.push(`${view['jul-date']}: ${view['jul-amount']}. ${view['jul-detail']}`);
  lines.push(`Take-home after costs and tax: ${view['take-home']} (${view['take-home-month']})`, '', view['mtd-status'], '', RESULTS_DISCLAIMER, pageUrl);
  return lines.join('\n');
}
