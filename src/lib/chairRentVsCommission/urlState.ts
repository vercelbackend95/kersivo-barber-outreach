/**
 * Shareable scenarios in the URL hash (never query parameters, never results).
 * Only fields that differ from the defaults are written, e.g. #t=5000&c=45&vat=1.
 * Anything unknown or invalid falls back to the default through sanitizeInputs().
 */
import { DEFAULT_INPUTS, sanitizeInputs, type ChairRentInputs } from './engine';

export const HASH_KEYS: Readonly<Record<keyof ChairRentInputs, string>> = {
  monthlyTakingsGbp: 't',
  quietMonths: 'q',
  quietMonthPercent: 'qp',
  shopVatRegistered: 'vat',
  averageServicePriceGbp: 'avg',
  commissionPercent: 'c',
  commissionOnGross: 'cg',
  weeklyHours: 'h',
  monthlyHoursOverride: 'mh',
  wageBand: 'age',
  apprenticeUnder25: 'ap',
  includeHolidayPay: 'hol',
  pensionEnrolled: 'pen',
  employmentAllowanceAvailable: 'ea',
  employmentAllowanceGbp: 'eaa',
  productsPercent: 'p',
  cardFeePercent: 'cf',
  cardFeeFixedPence: 'cfp',
  cardSharePercent: 'cs',
  softwareMonthlyGbp: 'sw',
  weeklyRentGbp: 'r',
  rentWeeksPerYear: 'rw',
  extraCostsWeeklyGbp: 'x',
  chargeVatOnRent: 'rv',
  renterProductsPercent: 'rp',
  renterCardFeePercent: 'rcf',
  renterCardFeeFixedPence: 'rcfp',
  renterCardSharePercent: 'rcs',
  renterSoftwareMonthlyGbp: 'rsw',
  renterOtherMonthlyGbp: 'ro',
  showBarberSide: 'bs',
};

const keyByShort = new Map(Object.entries(HASH_KEYS).map(([field, short]) => [short, field as keyof ChairRentInputs]));

export function inputsToHash(inputs: ChairRentInputs): string {
  const parts: string[] = [];
  for (const field of Object.keys(HASH_KEYS) as (keyof ChairRentInputs)[]) {
    const value = inputs[field];
    if (value === DEFAULT_INPUTS[field]) continue;
    const encoded = typeof value === 'boolean' ? (value ? '1' : '0') : String(typeof value === 'number' ? Number(value.toFixed(2)) : value);
    parts.push(`${HASH_KEYS[field]}=${encodeURIComponent(encoded)}`);
  }
  return parts.length ? `#${parts.join('&')}` : '';
}

export function hashToInputs(hash: string): ChairRentInputs {
  const raw: Partial<Record<keyof ChairRentInputs, unknown>> = {};
  for (const pair of hash.replace(/^#/, '').split('&')) {
    if (!pair) continue;
    const [short, encoded = ''] = pair.split('=');
    const field = keyByShort.get(short);
    if (!field) continue;
    let value: string;
    try {
      value = decodeURIComponent(encoded);
    } catch {
      continue;
    }
    if (typeof DEFAULT_INPUTS[field] === 'boolean') {
      if (value === '1' || value === '0') raw[field] = value === '1';
    } else {
      raw[field] = value;
    }
  }
  return sanitizeInputs(raw);
}
