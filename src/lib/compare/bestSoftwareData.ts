/**
 * Specific, number-led comparisons for the /compare "best barber software UK" page.
 *
 * Every figure is derived from the competitor facts modules (never retyped here) so the
 * cost meter, the new-client fee calculator and the head-to-head stay in step with the
 * *-alternative pages. The client script only re-applies these published parameters.
 */
import type { HubCriterionId } from '@/lib/compare/alternativesHubCriteria';
import { DATA_EXPORT_RETENTION_CLAIM, KERSIVO_COMMISSION_WITH_STRIPE } from '@/lib/pricing/claimsPolicy';
import { COMPETITOR_HUB_PLATFORMS, KERSIVO_HUB_PLATFORM, type HubPlatform } from '@/lib/compare/alternativesHubData';
import {
  BOOKSY_FACTS_CHECKED_DATE,
  estimateBooksyBoostFee,
  estimateBooksyMonthlySubscription,
  requireVerifiedBooksyFact,
} from '@/lib/seo/booksyFacts';
import { SAAS_MONTHLY_GBP } from '@/lib/seo/defaults';
import {
  FRESHA_FACTS_CHECKED_DATE,
  estimateFreshaMarketplaceNewClientFee,
  estimateFreshaMonthlySubscription,
  requireVerifiedFreshaFact,
} from '@/lib/seo/freshaFacts';
import { SETORA_FACTS_CHECKED_DATE, requireVerifiedSetoraFact } from '@/lib/seo/setoraFacts';
import { TREATWELL_FACTS_CHECKED_DATE, requireVerifiedTreatwellFact } from '@/lib/seo/treatwellFacts';
import { VAGARO_FACTS_CHECKED_DATE, requireVerifiedVagaroFact } from '@/lib/seo/vagaroFacts';

/* ---------- Team-size cost meter ---------- */

export const COST_METER_MIN_BARBERS = 1;
export const COST_METER_MAX_BARBERS = 12;
export const COST_METER_DEFAULT_BARBERS = 5;

export type CostMeterRow = {
  id: 'kersivo' | 'setora' | 'booksy' | 'fresha';
  name: string;
  /** How the price is built, shown under the name. */
  basis: string;
  /** Monthly amount actually paid (VAT included where the provider adds it), index 0 = 1 barber. */
  monthlyGbp: number[];
  isFirstParty: boolean;
  href: string;
};

const barberCounts = Array.from(
  { length: COST_METER_MAX_BARBERS - COST_METER_MIN_BARBERS + 1 },
  (_, i) => i + COST_METER_MIN_BARBERS,
);

const setoraMonthly = requireVerifiedSetoraFact('canonicalMonthlyGbp').value as number;
const setoraVatAdded = requireVerifiedSetoraFact('vatCurrentlyAdded').value as boolean;

export const COST_METER_ROWS: readonly CostMeterRow[] = [
  {
    id: 'kersivo',
    name: 'Full KERSIVO',
    basis: 'Per location, any team size. No VAT added.',
    monthlyGbp: barberCounts.map(() => SAAS_MONTHLY_GBP),
    isFirstParty: true,
    href: '/pricing#plan',
  },
  {
    id: 'setora',
    name: 'Setora',
    basis: setoraVatAdded ? 'Per location, plus VAT.' : 'Per location. No VAT currently added.',
    monthlyGbp: barberCounts.map(() => setoraMonthly),
    isFirstParty: false,
    href: '/setora-alternative',
  },
  {
    id: 'booksy',
    name: 'Booksy',
    basis: 'Base plan plus each additional user, inc. 20% VAT.',
    monthlyGbp: barberCounts.map((n) => estimateBooksyMonthlySubscription(n).incVatGbp),
    isFirstParty: false,
    href: '/booksy-alternative',
  },
  {
    id: 'fresha',
    name: 'Fresha',
    basis: 'Per bookable team member, inc. 20% VAT.',
    monthlyGbp: barberCounts.map((n) => estimateFreshaMonthlySubscription(n).incVatGbp),
    isFirstParty: false,
    href: '/fresha-alternative',
  },
];

export const COST_METER_NOTE = `Subscription only, from each provider’s published UK prices (Booksy checked ${BOOKSY_FACTS_CHECKED_DATE}, Fresha ${FRESHA_FACTS_CHECKED_DATE}, Setora ${SETORA_FACTS_CHECKED_DATE}). Card processing, add-ons, SMS top-ups and marketplace fees are not included.`;

export function costMeterValue(row: CostMeterRow, barbers: number): number {
  const index = Math.min(Math.max(barbers, COST_METER_MIN_BARBERS), COST_METER_MAX_BARBERS) - COST_METER_MIN_BARBERS;
  return row.monthlyGbp[index];
}

/** Yearly difference between the most expensive listed row and Full KERSIVO for a team size. */
export function costMeterYearlyGap(barbers: number): { name: string; gbp: number } {
  const kersivo = costMeterValue(COST_METER_ROWS[0], barbers);
  const priciest = COST_METER_ROWS.slice(1).reduce((a, b) => (costMeterValue(b, barbers) > costMeterValue(a, barbers) ? b : a));
  return { name: priciest.name, gbp: Math.round((costMeterValue(priciest, barbers) - kersivo) * 12 * 100) / 100 };
}

/* ---------- New-client fee calculator ---------- */

export const NEW_CLIENT_PRICE_MIN = 10;
export const NEW_CLIENT_PRICE_MAX = 60;
export const NEW_CLIENT_PRICE_DEFAULT = 25;

export type NewClientFeeRow = {
  id: 'kersivo' | 'booksy' | 'fresha' | 'vagaro' | 'treatwell';
  name: string;
  percent: number;
  minimumGbp: number;
  /** When the fee applies, in plain English. */
  when: string;
  isFirstParty: boolean;
  href: string;
};

const booksyBoost = requireVerifiedBooksyFact('boostNewClientFee');
const freshaMarketplace = requireVerifiedFreshaFact('marketplaceNewClientFee');
const vagaroNewClient = requireVerifiedVagaroFact('marketplaceNewClientFirstBookingPercent');
const treatwellNewClient = requireVerifiedTreatwellFact('newMarketplaceClientCommission');

export const NEW_CLIENT_FEE_ROWS: readonly NewClientFeeRow[] = [
  {
    id: 'kersivo',
    name: 'KERSIVO',
    percent: 0,
    minimumGbp: 0,
    when: '0% KERSIVO commission on every booking. Stripe fees apply to online payments.',
    isFirstParty: true,
    href: '/pricing#plan',
  },
  {
    id: 'fresha',
    name: 'Fresha',
    percent: freshaMarketplace.percent!,
    minimumGbp: freshaMarketplace.minimumGbp!,
    when: 'One-time, plus VAT, on a brand-new client from the Fresha Marketplace.',
    isFirstParty: false,
    href: '/fresha-alternative',
  },
  {
    id: 'booksy',
    name: 'Booksy',
    percent: booksyBoost.percent!,
    minimumGbp: booksyBoost.minimumGbp!,
    when: 'One-time, plus VAT, only when optional Boost brings the client.',
    isFirstParty: false,
    href: '/booksy-alternative',
  },
  {
    id: 'vagaro',
    name: 'Vagaro',
    percent: vagaroNewClient.value,
    minimumGbp: 0,
    when: 'On a qualifying new client’s first booking from Vagaro’s marketplace channels.',
    isFirstParty: false,
    href: '/vagaro-alternative',
  },
  {
    id: 'treatwell',
    name: 'Treatwell',
    percent: treatwellNewClient.percent!,
    minimumGbp: 0,
    when: 'Plus VAT, on an eligible new client introduced by the Treatwell marketplace.',
    isFirstParty: false,
    href: '/treatwell-alternative',
  },
];

export const NEW_CLIENT_FEE_NOTE = `Published UK rates (Booksy checked ${BOOKSY_FACTS_CHECKED_DATE}, Fresha ${FRESHA_FACTS_CHECKED_DATE}, Treatwell ${TREATWELL_FACTS_CHECKED_DATE}, Vagaro ${VAGARO_FACTS_CHECKED_DATE}). These fees apply only to qualifying new clients from each marketplace; repeat and direct bookings are not charged this way. Card processing is separate on every platform.`;

export function newClientFee(row: NewClientFeeRow, priceGbp: number): number {
  if (row.percent === 0) return 0;
  return Math.round(Math.max((priceGbp * row.percent) / 100, row.minimumGbp) * 100) / 100;
}

/** Cross-check against the facts modules' own estimators (used by tests). */
export function referenceNewClientFee(id: NewClientFeeRow['id'], priceGbp: number): number | null {
  if (id === 'booksy') return estimateBooksyBoostFee(priceGbp);
  if (id === 'fresha') return estimateFreshaMarketplaceNewClientFee(priceGbp);
  return null;
}

/* ---------- Head-to-head and control map ---------- */

/** Rows of the KERSIVO vs competitor switcher, in reading order. */
export const DUEL_CRITERIA: readonly { id: HubCriterionId; label: string }[] = [
  { id: 'zeroCommission', label: 'Commission on bookings' },
  { id: 'ownDomain', label: 'Your own website and domain' },
  { id: 'brandedBooking', label: 'Booking journey under your brand' },
  { id: 'clientDataExport', label: 'Export your client list' },
  { id: 'deposits', label: 'Deposits and no-show protection' },
  { id: 'migration', label: 'Help switching from your current system' },
];

/** Columns of the control map: who owns the client relationship. */
export const CONTROL_CRITERIA: readonly { id: HubCriterionId; label: string; short: string }[] = [
  { id: 'ownDomain', label: 'Own website and domain', short: 'Site' },
  { id: 'brandedBooking', label: 'Booking under your brand', short: 'Brand' },
  { id: 'zeroCommission', label: 'No commission on bookings', short: '0% fee' },
  { id: 'clientDataExport', label: 'Client list export', short: 'Export' },
  { id: 'migration', label: 'Switching help', short: 'Switch' },
];

export const DUEL_DEFAULT_ID = 'booksy';

/**
 * Shorter KERSIVO answers for the head-to-head, built from approved claims only.
 * Anything not listed falls back to the registry note.
 */
export const DUEL_KERSIVO_NOTES: Partial<Record<HubCriterionId, string>> = {
  zeroCommission: KERSIVO_COMMISSION_WITH_STRIPE,
  clientDataExport: `${DATA_EXPORT_RETENTION_CLAIM.split('. ')[0]}.`,
};

export function duelPlatforms(): { kersivo: HubPlatform; competitors: readonly HubPlatform[] } {
  return { kersivo: KERSIVO_HUB_PLATFORM, competitors: COMPETITOR_HUB_PLATFORMS };
}

export function formatMoney(value: number): string {
  return Number.isInteger(value) ? `£${value}` : `£${value.toFixed(2)}`;
}
