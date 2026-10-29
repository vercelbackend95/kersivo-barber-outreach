/**
 * Barbershop no-show cost and deposit engine.
 *
 * Pure, framework-free and browser-safe. Implements the method from the Insights
 * article /insights/barbershop-no-show-cost-when-deposit-makes-sense:
 * contribution = money in − products − card fees, weighted by the chance that a
 * walk-in refills the empty slot. Fixed wages, rent and rates are excluded
 * because they are paid whether or not the client turns up.
 *
 * All money is in pounds. Round only for display.
 */

export type ShopPaymentMethod = 'card' | 'cash';
export type ChairModel = 'owner' | 'commission' | 'rent';
export type DepositType = 'fixed5' | 'custom' | 'full';
export type BalancePayment = 'same' | ShopPaymentMethod;

export type NoShowInputs = {
  /** Average service price P (£). */
  price: number;
  /** Appointments booked per week A. */
  appointments: number;
  /** No-shows per week N. */
  noShows: number;
  weeksOpen: number;
  /** Products / consumables per service C (£). */
  products: number;
  cardFeePercent: number;
  cardFeeFixedPence: number;
  shopPayment: ShopPaymentMethod;
  /** Share of no-shows that fall at busy times (%). */
  busySharePercent: number;
  busyRefillPercent: number;
  quietRefillPercent: number;
  chairModel: ChairModel;
  /** Commission model: the barber's share of the service price (%). */
  barberCommissionPercent: number;
  depositType: DepositType;
  /** Custom fixed deposit amount (£1–£50). */
  customDeposit: number;
  balancePayment: BalancePayment;
  /** Is the deposit kept when the slot is refilled? */
  keepDepositWhenRefilled: boolean;
  /** Expected fall in the no-show rate with a deposit (%). */
  noShowReductionPercent: number;
  /** Bookings lost because of the deposit (%). */
  lostBookingsPercent: number;
};

/** Example numbers only — not benchmarks. Mirrors the article's worked example. */
export const DEFAULT_NO_SHOW_INPUTS: NoShowInputs = {
  price: 25,
  appointments: 80,
  noShows: 3,
  weeksOpen: 50,
  products: 1,
  cardFeePercent: 1.5,
  cardFeeFixedPence: 20,
  shopPayment: 'card',
  busySharePercent: 30,
  busyRefillPercent: 60,
  quietRefillPercent: 10,
  chairModel: 'owner',
  barberCommissionPercent: 50,
  depositType: 'fixed5',
  customDeposit: 10,
  balancePayment: 'same',
  keepDepositWhenRefilled: true,
  noShowReductionPercent: 0,
  lostBookingsPercent: 0,
};

export const KERSIVO_FIXED_DEPOSIT_GBP = 5;

export type CardFee = { percent: number; fixedPence: number };

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, finite(value, min)));
}

/** Fee for one card payment of `amount`. No payment, no fee. */
export function cardFee(amount: number, fee: CardFee): number {
  if (!(amount > 0)) return 0;
  return amount * (fee.percent / 100) + fee.fixedPence / 100;
}

/** Fee for one in-shop payment: card fee for card, nothing for cash. */
export function shopFee(amount: number, method: ShopPaymentMethod, fee: CardFee): number {
  return method === 'card' ? cardFee(amount, fee) : 0;
}

export type DepositTerms = {
  /** Online deposit / prepayment D (£). Equals P for full payment. */
  amount: number;
  isFullPayment: boolean;
  /** True when a fixed deposit was ≥ the price and is treated as full payment. */
  coercedToFull: boolean;
};

export function resolveDeposit(inputs: NoShowInputs): DepositTerms {
  const price = Math.max(0, finite(inputs.price));
  if (inputs.depositType === 'full') {
    return { amount: price, isFullPayment: true, coercedToFull: false };
  }
  const fixed =
    inputs.depositType === 'fixed5'
      ? KERSIVO_FIXED_DEPOSIT_GBP
      : clampNumber(inputs.customDeposit, 1, 50);
  if (fixed >= price) {
    return { amount: price, isFullPayment: true, coercedToFull: true };
  }
  return { amount: fixed, isFullPayment: false, coercedToFull: false };
}

export type SlotOutcomes = {
  /** Walk-in refill contribution W. */
  walkIn: number;
  /** Turn-up contribution without a deposit, TU0. */
  turnUpNoDeposit: number;
  /** Turn-up contribution with a deposit, TU1. */
  turnUpDeposit: number;
  /** No-show with deposit, slot stays empty: D − feeCard(D). */
  emptyWithDeposit: number;
  /** No-show with deposit, slot refilled by a walk-in. */
  refilledWithDeposit: number;
};

export function slotOutcomes(inputs: NoShowInputs): SlotOutcomes {
  const P = Math.max(0, finite(inputs.price));
  const C = Math.max(0, finite(inputs.products));
  const fee: CardFee = {
    percent: Math.max(0, finite(inputs.cardFeePercent)),
    fixedPence: Math.max(0, finite(inputs.cardFeeFixedPence)),
  };
  const balanceMethod: ShopPaymentMethod =
    inputs.balancePayment === 'same' ? inputs.shopPayment : inputs.balancePayment;
  const deposit = resolveDeposit(inputs);
  const D = deposit.amount;

  const walkIn = P - C - shopFee(P, inputs.shopPayment, fee);
  const turnUpNoDeposit = walkIn;
  const turnUpDeposit = deposit.isFullPayment
    ? P - C - cardFee(P, fee)
    : P - C - cardFee(D, fee) - shopFee(P - D, balanceMethod, fee);
  const emptyWithDeposit = D - cardFee(D, fee);
  const refilledWithDeposit =
    walkIn + (inputs.keepDepositWhenRefilled ? D - cardFee(D, fee) : -cardFee(D, fee));

  return { walkIn, turnUpNoDeposit, turnUpDeposit, emptyWithDeposit, refilledWithDeposit };
}

/** Expected no-show outcome without a deposit: E0(r) = r × W. */
export function noShowValueNoDeposit(o: SlotOutcomes, refill: number): number {
  return refill * o.walkIn;
}

/** Expected no-show outcome with a deposit: E1(r) = (1 − r)(D − fee) + r × refilled. */
export function noShowValueDeposit(o: SlotOutcomes, refill: number): number {
  return (1 - refill) * o.emptyWithDeposit + refill * o.refilledWithDeposit;
}

/** L0(r) = TU0 − E0(r). */
export function lossNoDeposit(o: SlotOutcomes, refill: number): number {
  return o.turnUpNoDeposit - noShowValueNoDeposit(o, refill);
}

/** L1(r) = TU1 − E1(r). */
export function lossDeposit(o: SlotOutcomes, refill: number): number {
  return o.turnUpDeposit - noShowValueDeposit(o, refill);
}

export type BandMix = { busyShare: number; busyRefill: number; quietRefill: number };

export function bandMix(inputs: NoShowInputs): BandMix {
  return {
    busyShare: clampNumber(inputs.busySharePercent, 0, 100) / 100,
    busyRefill: clampNumber(inputs.busyRefillPercent, 0, 100) / 100,
    quietRefill: clampNumber(inputs.quietRefillPercent, 0, 100) / 100,
  };
}

/** Band-weighted value: s × f(rBusy) + (1 − s) × f(rQuiet). */
export function weighted(mix: BandMix, f: (refill: number) => number): number {
  return mix.busyShare * f(mix.busyRefill) + (1 - mix.busyShare) * f(mix.quietRefill);
}

export type CarrierShare = {
  model: ChairModel;
  /** Fraction of the loss carried by the shop (0–1). */
  shopShare: number;
  /** Fraction carried by the barber or renter (0–1). */
  barberShare: number;
};

export function carrierShare(inputs: NoShowInputs): CarrierShare {
  if (inputs.chairModel === 'rent') return { model: 'rent', shopShare: 0, barberShare: 1 };
  if (inputs.chairModel === 'commission') {
    const barber = clampNumber(inputs.barberCommissionPercent, 0, 100) / 100;
    return { model: 'commission', shopShare: 1 - barber, barberShare: barber };
  }
  return { model: 'owner', shopShare: 1, barberShare: 0 };
}

export type BreakEven =
  /** Deposit already comes out ahead (or level) with no fall in no-shows. */
  | { kind: 'positive-at-zero' }
  /** Reduction (%) at which the deposit breaks even, 0 < x ≤ 100. */
  | { kind: 'reduction'; percent: number }
  /** Even 100% fewer no-shows would not make up the difference. */
  | { kind: 'not-reachable' };

export type NoShowResult = {
  outcomes: SlotOutcomes;
  deposit: DepositTerms;
  /** Appointments used in the calculation (N clamped to A). */
  appointments: number;
  noShows: number;
  weeks: number;
  /** No-show rate q = N / A (0–1). */
  noShowRate: number;
  /** Band-weighted loss per no-show without a deposit, L0. */
  lossPerNoShow: number;
  lossPerNoShowBusy: number;
  lossPerNoShowQuiet: number;
  /** Band-weighted loss per no-show with a deposit, L1. */
  lossPerNoShowWithDeposit: number;
  weeklyCost: number;
  yearlyCost: number;
  /** yearly / TU0, or null when TU0 ≤ 0. */
  servicesWorth: number | null;
  carrier: CarrierShare;
  withDeposit: {
    bookingsWithDeposit: number;
    noShowsWithDeposit: number;
    weeklyTotalNoDeposit: number;
    weeklyTotalWithDeposit: number;
    /** (Tot1 − Tot0) × weeks. */
    yearlyNetEffect: number;
    /** Yearly components; they sum to yearlyNetEffect. */
    depositsRetained: number;
    extraCardFees: number;
    fewerNoShows: number;
    lostBookings: number;
    /** Yearly cost of no-shows with a deposit on the same basis as yearlyCost (A·TU0 − Tot1); differs from it by exactly yearlyNetEffect. */
    yearlyCostWithDeposit: number;
    breakEven: BreakEven;
  };
  fairness: {
    /** Deposit higher than the estimated quiet-slot net loss (fixed deposits only). */
    depositAboveQuietLoss: boolean;
  };
};

export function calculateNoShowCost(inputs: NoShowInputs): NoShowResult {
  const outcomes = slotOutcomes(inputs);
  const deposit = resolveDeposit(inputs);
  const mix = bandMix(inputs);

  const A = Math.max(0, finite(inputs.appointments));
  const N = clampNumber(inputs.noShows, 0, A);
  const weeks = clampNumber(inputs.weeksOpen, 0, 52);
  const q = A > 0 ? N / A : 0;

  const L0 = weighted(mix, (r) => lossNoDeposit(outcomes, r));
  const L1 = weighted(mix, (r) => lossDeposit(outcomes, r));
  const E0 = weighted(mix, (r) => noShowValueNoDeposit(outcomes, r));
  const E1 = weighted(mix, (r) => noShowValueDeposit(outcomes, r));
  const TU0 = outcomes.turnUpNoDeposit;
  const TU1 = outcomes.turnUpDeposit;

  const weeklyCost = N * L0;
  const yearlyCost = weeklyCost * weeks;

  const lost = clampNumber(inputs.lostBookingsPercent, 0, 100) / 100;
  const reduction = clampNumber(inputs.noShowReductionPercent, 0, 100) / 100;
  const Aprime = A * (1 - lost);
  const expectedNoShows = Aprime * q;
  const N1 = expectedNoShows * (1 - reduction);

  const tot0 = (A - N) * TU0 + N * E0;
  const tot1 = (Aprime - N1) * TU1 + N1 * E1;

  const lostBookingsWeekly = -(A - Aprime) * ((1 - q) * TU0 + q * E0);
  const fewerNoShowsWeekly = (expectedNoShows - N1) * (TU0 - E0);
  const extraCardFeesWeekly = -(Aprime - N1) * (TU0 - TU1);
  const depositsRetainedWeekly = N1 * (E1 - E0);

  // Tot1(ρ) = A'·TU1 − A'·q·(1 − ρ)·L1 is linear in the reduction ρ.
  let breakEven: BreakEven;
  const tot1AtZero = Aprime * TU1 - expectedNoShows * L1;
  if (tot1AtZero >= tot0 - 1e-9) {
    breakEven = { kind: 'positive-at-zero' };
  } else {
    const slope = expectedNoShows * L1;
    const rho = slope > 0 ? 1 - (Aprime * TU1 - tot0) / slope : Number.POSITIVE_INFINITY;
    breakEven =
      Number.isFinite(rho) && rho > 0 && rho <= 1
        ? { kind: 'reduction', percent: rho * 100 }
        : { kind: 'not-reachable' };
  }

  const fixedDeposit = !deposit.isFullPayment;
  const quietLoss = lossNoDeposit(outcomes, mix.quietRefill);

  return {
    outcomes,
    deposit,
    appointments: A,
    noShows: N,
    weeks,
    noShowRate: q,
    lossPerNoShow: L0,
    lossPerNoShowBusy: lossNoDeposit(outcomes, mix.busyRefill),
    lossPerNoShowQuiet: quietLoss,
    lossPerNoShowWithDeposit: L1,
    weeklyCost,
    yearlyCost,
    servicesWorth: TU0 > 0 ? yearlyCost / TU0 : null,
    carrier: carrierShare(inputs),
    withDeposit: {
      bookingsWithDeposit: Aprime,
      noShowsWithDeposit: N1,
      weeklyTotalNoDeposit: tot0,
      weeklyTotalWithDeposit: tot1,
      yearlyNetEffect: (tot1 - tot0) * weeks,
      depositsRetained: depositsRetainedWeekly * weeks,
      extraCardFees: extraCardFeesWeekly * weeks,
      fewerNoShows: fewerNoShowsWeekly * weeks,
      lostBookings: lostBookingsWeekly * weeks,
      yearlyCostWithDeposit: yearlyCost - (tot1 - tot0) * weeks,
      breakEven,
    },
    fairness: {
      depositAboveQuietLoss: fixedDeposit && deposit.amount > quietLoss,
    },
  };
}
