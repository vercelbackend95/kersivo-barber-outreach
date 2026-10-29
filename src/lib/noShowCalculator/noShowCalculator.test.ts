import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NO_SHOW_INPUTS,
  calculateNoShowCost,
  cardFee,
  lossDeposit,
  lossNoDeposit,
  resolveDeposit,
  slotOutcomes,
  type NoShowInputs,
} from './noShowCalculator';

/** The article's worked example: £25 cut, £1 products, 1.5% + 20p, £5 deposit kept. */
const ARTICLE: NoShowInputs = { ...DEFAULT_NO_SHOW_INPUTS };

function inputs(overrides: Partial<NoShowInputs> = {}): NoShowInputs {
  return { ...ARTICLE, ...overrides };
}

function allFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value && typeof value === 'object') return Object.values(value).every(allFinite);
  return true;
}

describe('article worked example (/insights/barbershop-no-show-cost-when-deposit-makes-sense)', () => {
  const o = slotOutcomes(ARTICLE);

  it('reproduces the contribution table', () => {
    expect(o.turnUpDeposit).toBeCloseTo(23.225, 10);
    expect(o.turnUpNoDeposit).toBeCloseTo(23.425, 10);
    expect(o.emptyWithDeposit).toBeCloseTo(4.725, 10);
    expect(o.refilledWithDeposit).toBeCloseTo(28.15, 10);
  });

  it('reproduces the split-payment card fees (£0.775 vs £0.575)', () => {
    const fee = { percent: 1.5, fixedPence: 20 };
    expect(cardFee(5, fee) + cardFee(20, fee)).toBeCloseTo(0.775, 10);
    expect(cardFee(25, fee)).toBeCloseTo(0.575, 10);
  });

  it('reproduces the expected losses: Saturday £4.45, Tuesday £21.08 and £16.16', () => {
    expect(lossDeposit(o, 0.6)).toBeCloseTo(4.445, 10);
    expect(lossNoDeposit(o, 0.1)).toBeCloseTo(21.0825, 10);
    expect(lossDeposit(o, 0.1)).toBeCloseTo(16.1575, 10);
    expect(lossDeposit(o, 0.6).toFixed(2)).toBe('4.45');
    expect(lossNoDeposit(o, 0.1).toFixed(2)).toBe('21.08');
    expect(lossDeposit(o, 0.1).toFixed(2)).toBe('16.16');
  });

  it('single band (100% busy at 60%) gives the Saturday figure as the weighted loss', () => {
    const r = calculateNoShowCost(inputs({ busySharePercent: 100, busyRefillPercent: 60 }));
    expect(r.lossPerNoShowWithDeposit).toBeCloseTo(4.445, 10);
  });

  it('single band (0% busy, quiet 10%) gives the Tuesday figures', () => {
    const r = calculateNoShowCost(inputs({ busySharePercent: 0, quietRefillPercent: 10 }));
    expect(r.lossPerNoShow).toBeCloseTo(21.0825, 10);
    expect(r.lossPerNoShowWithDeposit).toBeCloseTo(16.1575, 10);
  });
});

describe('default example numbers', () => {
  const r = calculateNoShowCost(ARTICLE);

  it('weights busy and quiet losses by the busy share', () => {
    expect(r.lossPerNoShowBusy).toBeCloseTo(9.37, 10);
    expect(r.lossPerNoShowQuiet).toBeCloseTo(21.0825, 10);
    expect(r.lossPerNoShow).toBeCloseTo(0.3 * 9.37 + 0.7 * 21.0825, 10);
  });

  it('works out weekly and yearly cost', () => {
    expect(r.weeklyCost).toBeCloseTo(3 * 17.56875, 10);
    expect(r.yearlyCost).toBeCloseTo(3 * 17.56875 * 50, 10);
    expect(r.servicesWorth).toBeCloseTo((3 * 17.56875 * 50) / 23.425, 10);
    expect(r.noShowRate).toBeCloseTo(3 / 80, 10);
  });

  it('deposit components sum to the net yearly effect', () => {
    const d = r.withDeposit;
    expect(d.depositsRetained + d.extraCardFees + d.fewerNoShows + d.lostBookings).toBeCloseTo(d.yearlyNetEffect, 8);
    // 3 kept deposits × £4.725 − 77 turn-ups × £0.20 extra fixed fee, × 50 weeks.
    expect(d.depositsRetained).toBeCloseTo(3 * 4.725 * 50, 8);
    expect(d.extraCardFees).toBeCloseTo(-77 * 0.2 * 50, 8);
    expect(d.yearlyNetEffect).toBeCloseTo(-61.25, 8);
    expect(d.yearlyCostWithDeposit).toBeCloseTo(r.yearlyCost + 61.25, 8);
  });

  it('solves the break-even reduction', () => {
    const be = r.withDeposit.breakEven;
    expect(be.kind).toBe('reduction');
    if (be.kind !== 'reduction') return;
    const atBreakEven = calculateNoShowCost(inputs({ noShowReductionPercent: be.percent }));
    expect(atBreakEven.withDeposit.yearlyNetEffect).toBeCloseTo(0, 6);
    expect(be.percent).toBeGreaterThan(0);
    expect(be.percent).toBeLessThan(100);
  });

  it('does not flag a £5 deposit against a £21.08 quiet-slot loss', () => {
    expect(r.fairness.depositAboveQuietLoss).toBe(false);
  });
});

describe('payment methods and deposit types', () => {
  it('cash in the shop: no card fee on in-shop payments, online deposit still by card', () => {
    const o = slotOutcomes(inputs({ shopPayment: 'cash' }));
    expect(o.walkIn).toBeCloseTo(24, 10);
    expect(o.turnUpNoDeposit).toBeCloseTo(24, 10);
    expect(o.turnUpDeposit).toBeCloseTo(24 - 0.275, 10);
    expect(o.emptyWithDeposit).toBeCloseTo(4.725, 10);
    expect(o.refilledWithDeposit).toBeCloseTo(24 + 4.725, 10);
  });

  it('balance can be paid differently from walk-ins', () => {
    const o = slotOutcomes(inputs({ shopPayment: 'card', balancePayment: 'cash' }));
    expect(o.turnUpDeposit).toBeCloseTo(25 - 1 - 0.275, 10);
    expect(o.walkIn).toBeCloseTo(23.425, 10);
  });

  it('full prepayment: one card payment of P at booking', () => {
    const o = slotOutcomes(inputs({ depositType: 'full' }));
    expect(o.turnUpDeposit).toBeCloseTo(23.425, 10);
    expect(o.emptyWithDeposit).toBeCloseTo(25 - 0.575, 10);
    expect(o.refilledWithDeposit).toBeCloseTo(23.425 + 24.425, 10);
    const r = calculateNoShowCost(inputs({ depositType: 'full' }));
    expect(r.withDeposit.extraCardFees).toBeCloseTo(0, 10);
    expect(r.fairness.depositAboveQuietLoss).toBe(false);
  });

  it('kept = No: refunded deposit still costs its card fee when refilled', () => {
    const o = slotOutcomes(inputs({ keepDepositWhenRefilled: false }));
    expect(o.refilledWithDeposit).toBeCloseTo(23.425 - 0.275, 10);
    expect(o.emptyWithDeposit).toBeCloseTo(4.725, 10);
    // Saturday loss rises when the deposit is refunded on a refill, as the article says.
    expect(lossDeposit(o, 0.6)).toBeGreaterThan(4.445);
    expect(lossDeposit(o, 0.6)).toBeCloseTo(23.225 - (0.4 * 4.725 + 0.6 * 23.15), 10);
  });

  it('custom fixed deposit is clamped to £1–£50', () => {
    expect(resolveDeposit(inputs({ depositType: 'custom', customDeposit: 0 })).amount).toBe(1);
    expect(resolveDeposit(inputs({ depositType: 'custom', customDeposit: 80, price: 100 })).amount).toBe(50);
  });

  it('D ≥ P is treated as full payment', () => {
    const d = resolveDeposit(inputs({ depositType: 'custom', customDeposit: 30, price: 25 }));
    expect(d).toEqual({ amount: 25, isFullPayment: true, coercedToFull: true });
    const equal = resolveDeposit(inputs({ depositType: 'custom', customDeposit: 25, price: 25 }));
    expect(equal.isFullPayment).toBe(true);
    const r = calculateNoShowCost(inputs({ depositType: 'custom', customDeposit: 30 }));
    expect(r.outcomes.turnUpDeposit).toBeCloseTo(23.425, 10);
    expect(r.fairness.depositAboveQuietLoss).toBe(false);
  });

  it('£5 deposit on a £4 service becomes full payment', () => {
    expect(resolveDeposit(inputs({ price: 4 })).isFullPayment).toBe(true);
  });
});

describe('fairness check', () => {
  it('flags a fixed deposit above the quiet-slot net loss', () => {
    const r = calculateNoShowCost(inputs({ depositType: 'custom', customDeposit: 20, price: 25, quietRefillPercent: 50 }));
    expect(r.lossPerNoShowQuiet).toBeCloseTo(23.425 * 0.5, 10);
    expect(r.fairness.depositAboveQuietLoss).toBe(true);
  });
});

describe('edge cases', () => {
  it('A = N: every booking is a no-show', () => {
    const r = calculateNoShowCost(inputs({ appointments: 10, noShows: 10 }));
    expect(r.noShowRate).toBe(1);
    expect(r.weeklyCost).toBeCloseTo(10 * r.lossPerNoShow, 10);
    expect(allFinite(r)).toBe(true);
  });

  it('N above A is clamped to A', () => {
    const r = calculateNoShowCost(inputs({ appointments: 5, noShows: 9 }));
    expect(r.noShows).toBe(5);
  });

  it('zero inputs never produce NaN or Infinity', () => {
    const zero = inputs({
      price: 0,
      appointments: 0,
      noShows: 0,
      weeksOpen: 0,
      products: 0,
      cardFeePercent: 0,
      cardFeeFixedPence: 0,
      busySharePercent: 0,
      busyRefillPercent: 0,
      quietRefillPercent: 0,
    });
    const r = calculateNoShowCost(zero);
    expect(allFinite({ ...r, servicesWorth: r.servicesWorth ?? 0 })).toBe(true);
    expect(r.servicesWorth).toBeNull();
    expect(r.yearlyCost).toBe(0);
  });

  it('NaN inputs are treated as zero, not propagated', () => {
    const r = calculateNoShowCost(inputs({ price: Number.NaN, noShows: Number.NaN }));
    expect(allFinite({ ...r, servicesWorth: r.servicesWorth ?? 0 })).toBe(true);
  });

  it('no no-shows: deposit only adds split-payment fees, break-even not reachable', () => {
    const r = calculateNoShowCost(inputs({ noShows: 0 }));
    expect(r.yearlyCost).toBe(0);
    expect(r.withDeposit.yearlyNetEffect).toBeCloseTo(-80 * 0.2 * 50, 8);
    expect(r.withDeposit.breakEven.kind).toBe('not-reachable');
  });

  it('cash shop with full prepayment adds a card fee the shop did not pay before', () => {
    const r = calculateNoShowCost(inputs({ shopPayment: 'cash', depositType: 'full', noShows: 0 }));
    expect(r.withDeposit.extraCardFees).toBeCloseTo(-80 * 0.575 * 50, 8);
  });
});

describe('break-even solver', () => {
  it('reports positive-at-zero when the deposit already wins', () => {
    const r = calculateNoShowCost(inputs({ shopPayment: 'cash', balancePayment: 'cash', noShows: 10 }));
    expect(r.withDeposit.yearlyNetEffect).toBeGreaterThan(0);
    expect(r.withDeposit.breakEven.kind).toBe('positive-at-zero');
  });

  it('reports not-reachable when lost bookings outweigh any fall in no-shows', () => {
    const r = calculateNoShowCost(inputs({ lostBookingsPercent: 30 }));
    expect(r.withDeposit.breakEven.kind).toBe('not-reachable');
    const best = calculateNoShowCost(inputs({ lostBookingsPercent: 30, noShowReductionPercent: 100 }));
    expect(best.withDeposit.yearlyNetEffect).toBeLessThan(0);
  });

  it('the net effect is linear in the reduction and crosses zero at the solved point', () => {
    const base = inputs({ lostBookingsPercent: 1 });
    const be = calculateNoShowCost(base).withDeposit.breakEven;
    expect(be.kind).toBe('reduction');
    if (be.kind !== 'reduction') return;
    const below = calculateNoShowCost({ ...base, noShowReductionPercent: be.percent - 1 });
    const above = calculateNoShowCost({ ...base, noShowReductionPercent: be.percent + 1 });
    expect(below.withDeposit.yearlyNetEffect).toBeLessThan(0);
    expect(above.withDeposit.yearlyNetEffect).toBeGreaterThan(0);
  });

  it('lost bookings and fewer no-shows components have the expected signs', () => {
    const r = calculateNoShowCost(inputs({ lostBookingsPercent: 5, noShowReductionPercent: 50 }));
    expect(r.withDeposit.lostBookings).toBeLessThan(0);
    expect(r.withDeposit.fewerNoShows).toBeGreaterThan(0);
    const d = r.withDeposit;
    expect(d.depositsRetained + d.extraCardFees + d.fewerNoShows + d.lostBookings).toBeCloseTo(d.yearlyNetEffect, 8);
  });
});

describe('chair model', () => {
  it('owner or employed: shop carries 100%', () => {
    expect(calculateNoShowCost(ARTICLE).carrier).toEqual({ model: 'owner', shopShare: 1, barberShare: 0 });
  });

  it('commission: shared in line with the split', () => {
    const c = calculateNoShowCost(inputs({ chairModel: 'commission', barberCommissionPercent: 40 })).carrier;
    expect(c.shopShare).toBeCloseTo(0.6, 10);
    expect(c.barberShare).toBeCloseTo(0.4, 10);
  });

  it('chair rent: the renter carries the loss', () => {
    expect(calculateNoShowCost(inputs({ chairModel: 'rent' })).carrier).toEqual({ model: 'rent', shopShare: 0, barberShare: 1 });
  });
});
