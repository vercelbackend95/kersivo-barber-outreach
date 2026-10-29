/**
 * Field definitions, clamping and URL-hash state for the no-show calculator.
 * Browser-safe: no DOM access here, so the page and tests share one source.
 */
import {
  DEFAULT_NO_SHOW_INPUTS,
  type BalancePayment,
  type ChairModel,
  type DepositType,
  type NoShowInputs,
  type ShopPaymentMethod,
} from './noShowCalculator';

export type NumericKey = {
  [K in keyof NoShowInputs]: NoShowInputs[K] extends number ? K : never;
}[keyof NoShowInputs];

export type NumericField = {
  key: NumericKey;
  /** Short URL-hash key. */
  hash: string;
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Decimal places kept after clamping. */
  decimals: number;
  prefix?: '£';
  suffix?: '%' | 'p';
  helper?: string;
};

export const NUMERIC_FIELDS: readonly NumericField[] = [
  { key: 'price', hash: 'p', id: 'ns-price', label: 'Average service price', min: 0, max: 500, step: 0.5, decimals: 2, prefix: '£' },
  { key: 'appointments', hash: 'a', id: 'ns-appointments', label: 'Appointments booked per week', min: 0, max: 2000, step: 1, decimals: 0 },
  { key: 'noShows', hash: 'n', id: 'ns-no-shows', label: 'No-shows per week', min: 0, max: 2000, step: 1, decimals: 1 },
  { key: 'weeksOpen', hash: 'w', id: 'ns-weeks', label: 'Weeks open per year', min: 1, max: 52, step: 1, decimals: 0 },
  { key: 'products', hash: 'c', id: 'ns-products', label: 'Products and consumables per service', min: 0, max: 100, step: 0.1, decimals: 2, prefix: '£' },
  { key: 'cardFeePercent', hash: 'fp', id: 'ns-fee-percent', label: 'Card fee: percentage', min: 0, max: 10, step: 0.05, decimals: 2, suffix: '%' },
  { key: 'cardFeeFixedPence', hash: 'ff', id: 'ns-fee-fixed', label: 'Card fee: fixed amount', min: 0, max: 100, step: 1, decimals: 1, suffix: 'p' },
  { key: 'busySharePercent', hash: 'bs', id: 'ns-busy-share', label: 'Share of no-shows at busy times', min: 0, max: 100, step: 1, decimals: 0, suffix: '%' },
  { key: 'busyRefillPercent', hash: 'rb', id: 'ns-busy-refill', label: 'Chance a busy slot is refilled', min: 0, max: 100, step: 1, decimals: 0, suffix: '%' },
  { key: 'quietRefillPercent', hash: 'rq', id: 'ns-quiet-refill', label: 'Chance a quiet slot is refilled', min: 0, max: 100, step: 1, decimals: 0, suffix: '%', helper: 'For example, a walk-in taking a Saturday morning gap.' },
  { key: 'barberCommissionPercent', hash: 'bc', id: 'ns-barber-commission', label: 'Barber keeps', min: 0, max: 100, step: 1, decimals: 0, suffix: '%' },
  { key: 'customDeposit', hash: 'd', id: 'ns-custom-deposit', label: 'Deposit amount', min: 1, max: 50, step: 0.5, decimals: 2, prefix: '£' },
  { key: 'noShowReductionPercent', hash: 'red', id: 'ns-reduction', label: 'With a deposit, I expect no-shows to fall by', min: 0, max: 100, step: 1, decimals: 0, suffix: '%' },
  { key: 'lostBookingsPercent', hash: 'lost', id: 'ns-lost-bookings', label: 'Bookings I might lose because of the deposit', min: 0, max: 100, step: 1, decimals: 0, suffix: '%' },
];

export function numericField(key: NumericKey): NumericField {
  const field = NUMERIC_FIELDS.find((f) => f.key === key);
  if (!field) throw new Error(`Unknown no-show calculator field: ${key}`);
  return field;
}

type ChoiceField<T extends string> = { hash: string; name: string; values: readonly T[] };

export const SHOP_PAYMENT_FIELD: ChoiceField<ShopPaymentMethod> = { hash: 'pay', name: 'shopPayment', values: ['card', 'cash'] };
export const CHAIR_MODEL_FIELD: ChoiceField<ChairModel> = { hash: 'ch', name: 'chairModel', values: ['owner', 'commission', 'rent'] };
export const DEPOSIT_TYPE_FIELD: ChoiceField<DepositType> = { hash: 'dt', name: 'depositType', values: ['fixed5', 'custom', 'full'] };
export const BALANCE_PAYMENT_FIELD: ChoiceField<BalancePayment> = { hash: 'bal', name: 'balancePayment', values: ['same', 'card', 'cash'] };
export const KEEP_DEPOSIT_FIELD = { hash: 'kp', name: 'keepDepositWhenRefilled' } as const;

/** Parse user text into a finite number, accepting "£25", "1,5" or "25.00". */
export function parseNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;
  const cleaned = String(raw).trim().replace(/[£%p\s]/gi, '').replace(',', '.');
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function clampField(field: NumericField, value: number | null): number {
  const fallback = DEFAULT_NO_SHOW_INPUTS[field.key];
  const base = value == null ? fallback : value;
  const clamped = Math.min(field.max, Math.max(field.min, base));
  const factor = 10 ** field.decimals;
  return Math.round(clamped * factor) / factor;
}

function pickChoice<T extends string>(field: ChoiceField<T>, raw: string | null | undefined, fallback: T): T {
  return raw != null && (field.values as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** Clamp every field and keep no-shows within appointments. Never returns NaN. */
export function normaliseInputs(partial: Partial<Record<keyof NoShowInputs, unknown>>): NoShowInputs {
  const d = DEFAULT_NO_SHOW_INPUTS;
  const out = { ...d } as NoShowInputs;
  for (const field of NUMERIC_FIELDS) {
    const raw = partial[field.key];
    const parsed = raw === undefined ? null : parseNumber(raw as string | number);
    (out[field.key] as number) = clampField(field, raw === undefined ? d[field.key] : parsed);
  }
  out.noShows = Math.min(out.noShows, out.appointments);
  out.shopPayment = pickChoice(SHOP_PAYMENT_FIELD, partial.shopPayment as string, d.shopPayment);
  out.chairModel = pickChoice(CHAIR_MODEL_FIELD, partial.chairModel as string, d.chairModel);
  out.depositType = pickChoice(DEPOSIT_TYPE_FIELD, partial.depositType as string, d.depositType);
  out.balancePayment = pickChoice(BALANCE_PAYMENT_FIELD, partial.balancePayment as string, d.balancePayment);
  const keep = partial.keepDepositWhenRefilled;
  out.keepDepositWhenRefilled =
    keep === undefined ? d.keepDepositWhenRefilled : keep === true || keep === 'yes' || keep === '1';
  return out;
}

/** "#p=25&a=80&n=3…" — every field, so a shared link reproduces the same result. */
export function encodeHash(inputs: NoShowInputs): string {
  const params = new URLSearchParams();
  for (const field of NUMERIC_FIELDS) params.set(field.hash, String(inputs[field.key]));
  params.set(SHOP_PAYMENT_FIELD.hash, inputs.shopPayment);
  params.set(CHAIR_MODEL_FIELD.hash, inputs.chairModel);
  params.set(DEPOSIT_TYPE_FIELD.hash, inputs.depositType);
  params.set(BALANCE_PAYMENT_FIELD.hash, inputs.balancePayment);
  params.set(KEEP_DEPOSIT_FIELD.hash, inputs.keepDepositWhenRefilled ? '1' : '0');
  return `#${params.toString()}`;
}

/** Returns null when the hash holds no calculator state. */
export function decodeHash(hash: string): NoShowInputs | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const partial: Partial<Record<keyof NoShowInputs, unknown>> = {};
  let found = false;
  for (const field of NUMERIC_FIELDS) {
    const value = params.get(field.hash);
    if (value !== null) {
      partial[field.key] = value;
      found = true;
    }
  }
  const choices: Array<[keyof NoShowInputs, string]> = [
    ['shopPayment', SHOP_PAYMENT_FIELD.hash],
    ['chairModel', CHAIR_MODEL_FIELD.hash],
    ['depositType', DEPOSIT_TYPE_FIELD.hash],
    ['balancePayment', BALANCE_PAYMENT_FIELD.hash],
    ['keepDepositWhenRefilled', KEEP_DEPOSIT_FIELD.hash],
  ];
  for (const [key, hashKey] of choices) {
    const value = params.get(hashKey);
    if (value !== null) {
      partial[key] = value;
      found = true;
    }
  }
  return found ? normaliseInputs(partial) : null;
}
