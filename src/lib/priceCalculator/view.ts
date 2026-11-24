/**
 * Display layer shared by the server render and the browser script, so the page shows the
 * same text with or without JavaScript. All rounding happens here.
 */
import { UK_RATES_CHECKED_LABEL, UK_RATES_TAX_YEAR, VAT } from '@/data/uk-rates-2026-27';

const VAT_LABEL = `${Math.round(VAT.standardRate * 100)}% VAT`;
import { roundUpToStep, type PriceCalcResult, type PriceRiseCheck } from './engine';

const wholePounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const pence = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatGbp(value: number): string {
  return wholePounds.format(Math.round(value));
}

/** Client prices: rounded up to the next 50p, shown as £18 or £18.50. */
export function formatClientPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const rounded = roundUpToStep(Math.max(0, value));
  return Number.isInteger(rounded) ? formatGbp(rounded) : pence.format(rounded);
}

export function formatPencePrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return pence.format(value);
}

export function formatHours(value: number): string {
  return `${Math.round(value)} hrs`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function serviceLabel(name: string, index: number): string {
  return name || `Service ${index + 1}`;
}

export function priceRiseText(check: PriceRiseCheck): string {
  if (check.status === 'not-a-rise') return 'Enter a new price higher than the current one to test a price rise.';
  if (check.status === 'current-below-costs') {
    return 'At the current price, card fees and products already take everything from this service. Raise the price.';
  }
  const loss = Math.floor(check.maxClientLossPercent * 10 + 1e-6) / 10;
  const perHundred = Math.floor(check.maxClientLossPercent + 1e-6);
  return `You could lose up to ${loss.toFixed(1)}% of clients for this service (${perHundred} in every 100) and still keep the same money. Each one who stays leaves you ${pence.format(check.newKeptGbp - check.currentKeptGbp)} more, and the time freed up can go to new clients.`;
}

export const RESULTS_DISCLAIMER = `Estimates from the numbers you entered, using the ${UK_RATES_TAX_YEAR} VAT rate (checked ${UK_RATES_CHECKED_LABEL}). Prices are rounded up to the next 50p. Your take-home figure is before Income Tax and National Insurance. Not tax or financial advice.`;

export type ResultView = {
  text: Record<string, string>;
  hidden: Record<string, boolean>;
};

export function buildResultView(result: PriceCalcResult): ResultView {
  const noTime = result.bookedHoursPerMonth <= 0;
  const text: Record<string, string> = {
    'target-hour': result.targetPerBookedHourGbp === null ? '—' : formatGbp(result.targetPerBookedHourGbp),
    'floor-hour': result.floorPerBookedHourGbp === null ? '—' : formatGbp(result.floorPerBookedHourGbp),
    'booked-hours': formatHours(result.bookedHoursPerMonth),
    'fixed-costs': formatGbp(result.fixedCostsMonthlyGbp),
    'take-home': formatGbp(result.inputs.takeHomeMonthlyGbp),
    'vat-note': result.inputs.vatRegistered ? `Prices include ${VAT_LABEL}.` : 'Not VAT registered: prices have no VAT added.',
    'no-time': 'Enter your hours, weeks and how busy you are to see prices.',
    'rise-result': priceRiseText(result.priceRise),
    'sens-service': serviceLabel(result.inputs.services[0]?.name ?? '', 0),
  };
  result.sensitivity.forEach((row, index) => {
    text[`sens-${index}`] = formatClientPrice(row.targetPriceGbp);
  });
  return { text, hidden: { 'no-time': !noTime, 'sens-table': result.inputs.services.length === 0 } };
}

/** Plain-text summary for "Copy prices" (works in WhatsApp, Notes or an email to an accountant). */
export function buildSummaryText(result: PriceCalcResult, pageUrl: string): string {
  const lines = [
    'What to charge — KERSIVO barber price calculator',
    '',
    ...result.services.map(
      (service, index) =>
        `${serviceLabel(service.name, index)} (${formatMinutes(service.minutes)}): ${formatClientPrice(service.targetPriceGbp)} (covers costs from ${formatClientPrice(service.floorPriceGbp)})`,
    ),
    '',
    `Each booked hour needs to earn ${result.targetPerBookedHourGbp === null ? '—' : formatGbp(result.targetPerBookedHourGbp)} (${formatHours(result.bookedHoursPerMonth)} booked a month).`,
    `Costs ${formatGbp(result.fixedCostsMonthlyGbp)} a month, take-home target ${formatGbp(result.inputs.takeHomeMonthlyGbp)} a month before tax.`,
    result.inputs.vatRegistered ? `Prices include ${VAT_LABEL}.` : 'Not VAT registered.',
    '',
    pageUrl,
  ];
  return lines.join('\n');
}
